import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, users, type TaskRow } from '@/lib/db/schema';
import { createSession } from '@/lib/auth/session';
import { jar } from '@/test/mock-cookies';
import { GET as listTasks, POST as createTask } from './route';
import { DELETE as deleteTask, PATCH as updateTask } from './[id]/route';

vi.mock('next/headers', () => import('@/test/mock-cookies'));

const BASE = 'http://localhost/api/tasks';

const list = (query = '') => listTasks(new NextRequest(`${BASE}${query}`));
const create = (body: unknown) =>
  createTask(new Request(BASE, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const patch = (id: string, body: unknown) =>
  updateTask(new Request(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
const remove = (id: string) =>
  deleteTask(new Request(`${BASE}/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) });

let ada: string;
let bob: string;

async function loginAs(userId: string) {
  jar.clear();
  await createSession(userId);
}

async function insertTask(userId: string, values: Partial<TaskRow> = {}) {
  const [task] = await db.insert(tasks).values({ userId, title: 'A task', ...values }).returning();
  return task;
}

async function findTask(id: string) {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

beforeEach(async () => {
  jar.clear();
  await db.delete(users); // cascades to tasks and sessions
  const rows = await db
    .insert(users)
    .values([
      { email: 'ada@example.com', name: 'Ada', passwordHash: 'x' },
      { email: 'bob@example.com', name: 'Bob', passwordHash: 'x' },
    ])
    .returning();
  [ada, bob] = rows.map((u) => u.id);
});

describe('GET /api/tasks', () => {
  it('returns 401 when logged out', async () => {
    const res = await list();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns an empty list for a new user', async () => {
    await loginAs(ada);

    expect(await (await list()).json()).toEqual({ tasks: [] });
  });

  it("returns only the current user's tasks, newest first", async () => {
    await insertTask(ada, { title: 'older', createdAt: new Date('2026-01-01T00:00:00.000Z') });
    await insertTask(ada, { title: 'newer', createdAt: new Date('2026-01-01T00:00:00.001Z') });
    await insertTask(bob, { title: "Bob's task" });
    await loginAs(ada);

    const res = await list();

    expect(res.status).toBe(200);
    const { tasks: body } = await res.json();
    expect(body.map((t: { title: string }) => t.title)).toEqual(['newer', 'older']);
  });

  it('serialises the full task, with dates as ISO strings', async () => {
    await insertTask(ada, { title: 'T', dueDate: '2026-12-31', createdAt: new Date('2026-01-02T03:04:05.678Z') });
    await loginAs(ada);

    const [task] = (await (await list()).json()).tasks;

    expect(task).toEqual({
      id: expect.any(String),
      userId: ada,
      title: 'T',
      description: null,
      status: 'todo',
      priority: 'medium',
      dueDate: '2026-12-31',
      createdAt: '2026-01-02T03:04:05.678Z',
      updatedAt: expect.any(String),
    });
  });

  it('filters by ?status=', async () => {
    await insertTask(ada, { title: 'open', status: 'todo' });
    await insertTask(ada, { title: 'finished', status: 'done' });
    await insertTask(bob, { title: "Bob's finished", status: 'done' });
    await loginAs(ada);

    const { tasks: body } = await (await list('?status=done')).json();

    expect(body.map((t: { title: string }) => t.title)).toEqual(['finished']);
  });

  it('ignores an unknown ?status= value and returns everything', async () => {
    await insertTask(ada, { status: 'todo' });
    await insertTask(ada, { status: 'done' });
    await loginAs(ada);

    expect((await (await list('?status=blocked')).json()).tasks).toHaveLength(2);
  });
});

describe('POST /api/tasks', () => {
  it('returns 401 when logged out and creates nothing', async () => {
    expect((await create({ title: 'T' })).status).toBe(401);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it('creates a task with defaults for the current user', async () => {
    await loginAs(ada);

    const res = await create({ title: '  Write tests  ' });

    expect(res.status).toBe(201);
    const { task } = await res.json();
    expect(task).toMatchObject({
      userId: ada,
      title: 'Write tests',
      status: 'todo',
      priority: 'medium',
      description: null,
      dueDate: null,
    });
    expect(await findTask(task.id)).toMatchObject({ userId: ada, title: 'Write tests' });
  });

  it('creates a task with every field set', async () => {
    await loginAs(ada);
    const input = { title: 'Ship', description: 'Phase 5', status: 'in_progress', priority: 'high', dueDate: '2026-12-31' };

    const { task } = await (await create(input)).json();

    expect(task).toMatchObject(input);
  });

  it('ignores a userId in the body: the owner always comes from the session', async () => {
    await loginAs(ada);

    const { task } = await (await create({ title: 'Sneaky', userId: bob })).json();

    expect(task.userId).toBe(ada);
    expect((await findTask(task.id))?.userId).toBe(ada);
  });

  it('returns 400 with field issues for invalid input and creates nothing', async () => {
    await loginAs(ada);

    const res = await create({ title: '   ', status: 'blocked' });

    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).issues).sort()).toEqual(['status', 'title']);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it('returns 400 for a body that is not JSON', async () => {
    await loginAs(ada);

    expect((await create('{not json')).status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('returns 401 when logged out and changes nothing', async () => {
    const task = await insertTask(ada, { title: 'Original' });

    expect((await patch(task.id, { title: 'Changed' })).status).toBe(401);
    expect((await findTask(task.id))?.title).toBe('Original');
  });

  it('changes only the status, leaving every other field as it was', async () => {
    const task = await insertTask(ada, {
      title: 'Keep me',
      description: 'Keep me too',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-12-31',
    });
    await loginAs(ada);

    const res = await patch(task.id, { status: 'done' });

    expect(res.status).toBe(200);
    expect((await res.json()).task).toMatchObject({
      title: 'Keep me',
      description: 'Keep me too',
      status: 'done',
      priority: 'high',
      dueDate: '2026-12-31',
    });
  });

  it('edits the title without resetting the status (the Zod defaults pitfall, end to end)', async () => {
    const task = await insertTask(ada, { status: 'done', priority: 'low' });
    await loginAs(ada);

    await patch(task.id, { title: 'Renamed' });

    expect(await findTask(task.id)).toMatchObject({ title: 'Renamed', status: 'done', priority: 'low' });
  });

  it('clears optional fields when sent null', async () => {
    const task = await insertTask(ada, { description: 'Old', dueDate: '2026-12-31' });
    await loginAs(ada);

    await patch(task.id, { description: null, dueDate: null });

    expect(await findTask(task.id)).toMatchObject({ description: null, dueDate: null });
  });

  it('bumps updatedAt but not createdAt', async () => {
    const old = new Date('2026-01-01T00:00:00.000Z');
    const task = await insertTask(ada, { createdAt: old, updatedAt: old });
    await loginAs(ada);

    await patch(task.id, { title: 'Changed' });

    const row = await findTask(task.id);
    expect(row?.createdAt.getTime()).toBe(old.getTime());
    expect(row?.updatedAt.getTime()).toBeGreaterThan(old.getTime());
  });

  it.each([
    ['an empty body', {}],
    ['an unknown status', { status: 'blocked' }],
    ['a blank title', { title: '' }],
  ])('returns 400 for %s and changes nothing', async (_label, body) => {
    const task = await insertTask(ada, { title: 'Original' });
    await loginAs(ada);

    expect((await patch(task.id, body)).status).toBe(400);
    expect((await findTask(task.id))?.title).toBe('Original');
  });

  it('returns 404 for a task that does not exist', async () => {
    await loginAs(ada);

    const res = await patch('no-such-task', { title: 'X' });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it("returns 404 (not 403) for another user's task and leaves it untouched", async () => {
    const bobsTask = await insertTask(bob, { title: "Bob's", status: 'todo' });
    await loginAs(ada);

    const res = await patch(bobsTask.id, { title: 'Hijacked', status: 'done' });

    expect(res.status).toBe(404);
    expect(await findTask(bobsTask.id)).toMatchObject({ title: "Bob's", status: 'todo' });
  });

  it('cannot move a task to another user by sending userId', async () => {
    const task = await insertTask(ada);
    await loginAs(ada);

    await patch(task.id, { title: 'Still mine', userId: bob });

    expect((await findTask(task.id))?.userId).toBe(ada);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('returns 401 when logged out and deletes nothing', async () => {
    const task = await insertTask(ada);

    expect((await remove(task.id)).status).toBe(401);
    expect(await findTask(task.id)).toBeDefined();
  });

  it('deletes the task and returns 204 with no body', async () => {
    const task = await insertTask(ada);
    await loginAs(ada);

    const res = await remove(task.id);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await findTask(task.id)).toBeUndefined();
  });

  it('returns 404 when deleting the same task twice', async () => {
    const task = await insertTask(ada);
    await loginAs(ada);

    await remove(task.id);

    expect((await remove(task.id)).status).toBe(404);
  });

  it("returns 404 for another user's task and does not delete it", async () => {
    const bobsTask = await insertTask(bob);
    await loginAs(ada);

    expect((await remove(bobsTask.id)).status).toBe(404);
    expect(await findTask(bobsTask.id)).toBeDefined();
  });
});
