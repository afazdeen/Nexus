import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '@/lib/db';
import { sessions, tasks, users } from '@/lib/db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let db: Db;

beforeEach(() => {
  db = createDb(':memory:');
});

afterEach(() => {
  db.$client.close();
});

async function insertUser(email = 'ada@example.com') {
  const [user] = await db.insert(users).values({ email, name: 'Ada', passwordHash: 'salt:hash' }).returning();
  return user;
}

describe('createDb', () => {
  it('runs the migrations: all tables and indexes exist', () => {
    const names = db.$client
      .prepare(`SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((row) => (row as { name: string }).name);

    expect(names).toEqual(
      expect.arrayContaining([
        'users',
        'sessions',
        'tasks',
        'users_email_unique',
        'sessions_user_idx',
        'tasks_user_created_idx',
      ]),
    );
  });

  describe('with a database file', () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-portal-'));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('creates the parent folder and enables WAL and foreign keys', () => {
      const file = path.join(dir, 'nested', 'app.db');
      const fileDb = createDb(file);

      expect(fs.existsSync(file)).toBe(true);
      expect(fileDb.$client.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(fileDb.$client.pragma('foreign_keys', { simple: true })).toBe(1);

      fileDb.$client.close();
    });

    it('can be reopened: migrating again on startup keeps existing data', async () => {
      const file = path.join(dir, 'app.db');
      const first = createDb(file);
      await first.insert(users).values({ email: 'ada@example.com', name: 'Ada', passwordHash: 'x' });
      first.$client.close();

      const second = createDb(file);
      const rows = await second.select().from(users);
      second.$client.close();

      expect(rows).toHaveLength(1);
    });
  });
});

describe('users table', () => {
  it('generates a UUID id and a created_at timestamp', async () => {
    const user = await insertUser();

    expect(user.id).toMatch(UUID);
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate email', async () => {
    await insertUser('ada@example.com');

    await expect(insertUser('ada@example.com')).rejects.toThrow(/UNIQUE constraint failed: users\.email/);
  });
});

describe('tasks table', () => {
  it('applies defaults when only the title is given', async () => {
    const user = await insertUser();
    const [task] = await db.insert(tasks).values({ userId: user.id, title: 'Write tests' }).returning();

    expect(task).toMatchObject({
      title: 'Write tests',
      status: 'todo',
      priority: 'medium',
      description: null,
      dueDate: null,
    });
    expect(task.id).toMatch(UUID);
    expect(task.createdAt).toBeInstanceOf(Date);
    expect(task.updatedAt).toBeInstanceOf(Date);
  });

  it('keeps millisecond precision on timestamps (used for newest-first ordering)', async () => {
    const user = await insertUser();
    const createdAt = new Date('2026-01-02T03:04:05.678Z');
    const [task] = await db.insert(tasks).values({ userId: user.id, title: 'T', createdAt }).returning();

    expect(task.createdAt.getTime()).toBe(createdAt.getTime());
  });

  it('stores due dates as plain YYYY-MM-DD strings', async () => {
    const user = await insertUser();
    const [task] = await db.insert(tasks).values({ userId: user.id, title: 'T', dueDate: '2026-12-31' }).returning();

    expect(task.dueDate).toBe('2026-12-31');
  });

  it('rejects a task for a user that does not exist', async () => {
    await expect(db.insert(tasks).values({ userId: 'no-such-user', title: 'Orphan' })).rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );
  });
});

describe('deleting a user', () => {
  it('cascades to their tasks and sessions but leaves other users alone', async () => {
    const ada = await insertUser('ada@example.com');
    const bob = await insertUser('bob@example.com');
    const expiresAt = new Date(Date.now() + 60_000);

    await db.insert(tasks).values([
      { userId: ada.id, title: 'Ada task' },
      { userId: bob.id, title: 'Bob task' },
    ]);
    await db.insert(sessions).values([
      { id: 'ada-session', userId: ada.id, expiresAt },
      { id: 'bob-session', userId: bob.id, expiresAt },
    ]);

    await db.delete(users).where(eq(users.id, ada.id));

    expect(await db.select({ title: tasks.title }).from(tasks)).toEqual([{ title: 'Bob task' }]);
    expect(await db.select({ id: sessions.id }).from(sessions)).toEqual([{ id: 'bob-session' }]);
  });
});
