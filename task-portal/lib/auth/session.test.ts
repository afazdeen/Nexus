import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { SESSION_COOKIE } from '@/lib/constants';
import { createSession, deleteSession, getCurrentUser } from '@/lib/auth/session';
import { jar } from '@/test/mock-cookies';

vi.mock('next/headers', () => import('@/test/mock-cookies'));

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const DAY_MS = 24 * 60 * 60 * 1000;

function sessionCookie() {
  const cookie = jar.get(SESSION_COOKIE);
  if (!cookie) throw new Error('session cookie was not set');
  return cookie;
}

let userId: string;

beforeEach(async () => {
  jar.clear();
  await db.delete(users); // cascades to sessions
  const [user] = await db
    .insert(users)
    .values({ email: 'ada@example.com', name: 'Ada', passwordHash: 'salt:hash' })
    .returning();
  userId = user.id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createSession', () => {
  it('sets an httpOnly, SameSite=Lax cookie on / that expires in 7 days', async () => {
    const before = Date.now();
    await createSession(userId);

    const { value, options } = sessionCookie();
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });

    const expires = (options?.expires as Date).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(expires).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
  });

  it('marks the cookie Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await createSession(userId);

    expect(sessionCookie().options).toMatchObject({ secure: true });
  });

  it('stores only the SHA-256 of the token, never the token itself', async () => {
    await createSession(userId);
    const token = sessionCookie().value;

    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sha256(token));
    expect(rows[0].id).not.toBe(token);
    expect(rows[0].userId).toBe(userId);
  });

  it('issues a different token for every login', async () => {
    await createSession(userId);
    const first = sessionCookie().value;
    await createSession(userId);

    expect(sessionCookie().value).not.toBe(first);
    expect(await db.select().from(sessions)).toHaveLength(2);
  });

  it('cleans up expired sessions but keeps valid ones', async () => {
    await db.insert(sessions).values([
      { id: 'expired', userId, expiresAt: new Date(Date.now() - 1000) },
      { id: 'still-valid', userId, expiresAt: new Date(Date.now() + DAY_MS) },
    ]);

    await createSession(userId);

    const ids = (await db.select({ id: sessions.id }).from(sessions)).map((s) => s.id);
    expect(ids).not.toContain('expired');
    expect(ids).toContain('still-valid');
    expect(ids).toHaveLength(2);
  });
});

describe('getCurrentUser', () => {
  it('returns the user for a valid session, without the password hash', async () => {
    await createSession(userId);

    expect(await getCurrentUser()).toEqual({ id: userId, email: 'ada@example.com', name: 'Ada' });
  });

  it('returns null when there is no cookie', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('returns null for a token that matches no session', async () => {
    jar.set(SESSION_COOKIE, { value: 'made-up-token' });

    expect(await getCurrentUser()).toBeNull();
  });

  it('returns null when the cookie holds the stored hash instead of the token', async () => {
    await createSession(userId);
    const [row] = await db.select().from(sessions);
    jar.set(SESSION_COOKIE, { value: row.id });

    expect(await getCurrentUser()).toBeNull();
  });

  it('returns null once the session has expired', async () => {
    await createSession(userId);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });

    expect(await getCurrentUser()).toBeNull();
  });

  it('returns null after the user is deleted', async () => {
    await createSession(userId);
    await db.delete(users).where(eq(users.id, userId));

    expect(await getCurrentUser()).toBeNull();
  });
});

describe('deleteSession', () => {
  it('removes the session row and clears the cookie', async () => {
    await createSession(userId);

    await deleteSession();

    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect(await getCurrentUser()).toBeNull();
  });

  it('only ends the current session, leaving the user logged in elsewhere', async () => {
    await createSession(userId);
    const otherDevice = sessionCookie().value;
    await createSession(userId);

    await deleteSession();

    jar.set(SESSION_COOKIE, { value: otherDevice });
    expect(await getCurrentUser()).toMatchObject({ id: userId });
  });

  it('does nothing harmful when there is no cookie', async () => {
    await expect(deleteSession()).resolves.toBeUndefined();
  });
});
