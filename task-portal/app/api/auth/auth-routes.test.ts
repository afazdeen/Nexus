import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { SESSION_COOKIE } from '@/lib/constants';
import { verifyPassword } from '@/lib/auth/password';
import { jar } from '@/test/mock-cookies';
import { POST as register } from './register/route';
import { POST as login } from './login/route';
import { POST as logout } from './logout/route';
import { GET as me } from './me/route';

vi.mock('next/headers', () => import('@/test/mock-cookies'));

const ADA = { name: 'Ada', email: 'ada@example.com', password: 'password123' };

const post = (body: unknown) =>
  new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const loginAs = (email: string, password: string) => login(post({ email, password }));

beforeEach(async () => {
  jar.clear();
  await db.delete(users); // cascades to sessions
});

describe('POST /api/auth/register', () => {
  it('creates the user, logs them in, and returns 201 without the password hash', async () => {
    const res = await register(post(ADA));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ user: { id: expect.any(String), name: 'Ada', email: 'ada@example.com' } });
    expect(jar.has(SESSION_COOKIE)).toBe(true);
    expect((await (await me()).json()).user.id).toBe(body.user.id);
  });

  it('stores a scrypt hash, never the plain password', async () => {
    await register(post(ADA));

    const [row] = await db.select().from(users);
    expect(row.passwordHash).not.toContain(ADA.password);
    expect(await verifyPassword(ADA.password, row.passwordHash)).toBe(true);
  });

  it('normalises the email before saving', async () => {
    await register(post({ ...ADA, email: '  Ada@Example.COM ' }));

    const [row] = await db.select().from(users);
    expect(row.email).toBe('ada@example.com');
  });

  it('returns 409 for an email that is already registered, whatever its case', async () => {
    await register(post(ADA));
    jar.clear();

    const res = await register(post({ ...ADA, email: 'ADA@example.com' }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'An account with this email already exists' });
    expect(await db.select().from(users)).toHaveLength(1);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it('returns 400 with field issues for invalid input, and creates nothing', async () => {
    const res = await register(post({ name: '', email: 'nope', password: 'short' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.issues).sort()).toEqual(['email', 'name', 'password']);
    expect(await db.select().from(users)).toHaveLength(0);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it('returns 400 for a body that is not JSON', async () => {
    expect((await register(post('{not json'))).status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register(post(ADA));
    jar.clear(); // start logged out
  });

  it('returns the user and sets a session cookie for the right password', async () => {
    const res = await loginAs(ADA.email, ADA.password);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { id: expect.any(String), name: 'Ada', email: 'ada@example.com' } });
    expect(jar.has(SESSION_COOKIE)).toBe(true);
    expect(await db.select().from(sessions)).toHaveLength(2); // one from register, one from login
  });

  it('matches the email case-insensitively', async () => {
    expect((await loginAs('  ADA@example.com', ADA.password)).status).toBe(200);
  });

  it('gives the same 401 for a wrong password and for an unknown email', async () => {
    const wrongPassword = await loginAs(ADA.email, 'wrong-password');
    const unknownEmail = await loginAs('nobody@example.com', ADA.password);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual({ error: 'Invalid email or password' });
    expect(await unknownEmail.json()).toEqual({ error: 'Invalid email or password' });
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await login(post({ email: ADA.email }));

    expect(res.status).toBe(400);
    expect((await res.json()).issues).toHaveProperty('password');
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session and clears the cookie', async () => {
    await register(post(ADA));

    const res = await logout();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('succeeds even when nobody is logged in', async () => {
    expect((await logout()).status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 when logged out', async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 for a made-up session cookie', async () => {
    jar.set(SESSION_COOKIE, { value: 'made-up-token' });

    expect((await me()).status).toBe(401);
  });
});

describe('full auth flow', () => {
  it('register → me → logout → me → login → me', async () => {
    expect((await register(post(ADA))).status).toBe(201);
    expect((await me()).status).toBe(200);

    await logout();
    expect((await me()).status).toBe(401);

    expect((await loginAs(ADA.email, ADA.password)).status).toBe(200);
    expect(await (await me()).json()).toEqual({ user: { id: expect.any(String), email: ADA.email, name: 'Ada' } });
  });
});
