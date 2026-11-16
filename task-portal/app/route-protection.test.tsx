import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToHtml } from '@/test/render';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { SESSION_COOKIE } from '@/lib/constants';
import { createSession } from '@/lib/auth/session';
import { jar } from '@/test/mock-cookies';
import PortalLayout from './(portal)/layout';
import AuthLayout from './(auth)/layout';
import Home from './page';

vi.mock('next/headers', () => import('@/test/mock-cookies'));
// Only useRouter is replaced (the header's logout button calls it); redirect() stays real.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

/** Runs a server component and returns where it redirected to, or null if it rendered. */
async function redirectTarget(render: () => unknown): Promise<string | null> {
  try {
    await render();
    return null;
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;')) return digest.split(';')[2];
    throw error;
  }
}

const child = <p>page content</p>;

async function logIn() {
  const [user] = await db.insert(users).values({ email: 'ada@example.com', name: 'Ada', passwordHash: 'x' }).returning();
  await createSession(user.id);
}

beforeEach(async () => {
  jar.clear();
  await db.delete(users);
});

describe('(portal) layout: the real page-level check', () => {
  it('redirects to /login when logged out', async () => {
    expect(await redirectTarget(() => PortalLayout({ children: child }))).toBe('/login');
  });

  it('redirects to /login for a cookie that matches no session (the proxy lets these through)', async () => {
    jar.set(SESSION_COOKIE, { value: 'made-up-token' });

    expect(await redirectTarget(() => PortalLayout({ children: child }))).toBe('/login');
  });

  it('renders the page with the user in the header when logged in', async () => {
    await logIn();

    const html = renderToHtml(await PortalLayout({ children: child }));

    expect(html).toContain('page content');
    expect(html).toContain('Ada');
    expect(html).toContain('Log out');
  });
});

describe('(auth) layout', () => {
  it('renders the login/register page when logged out', async () => {
    const html = renderToHtml(await AuthLayout({ children: child }));

    expect(html).toContain('page content');
  });

  it('sends a logged-in user to /tasks', async () => {
    await logIn();

    expect(await redirectTarget(() => AuthLayout({ children: child }))).toBe('/tasks');
  });

  it('does NOT redirect for an invalid cookie, so an expired session cannot cause a redirect loop', async () => {
    jar.set(SESSION_COOKIE, { value: 'expired-or-made-up' });

    expect(await redirectTarget(() => AuthLayout({ children: child }))).toBeNull();
  });
});

describe('home page', () => {
  it('redirects to /tasks', async () => {
    expect(await redirectTarget(() => Home())).toBe('/tasks');
  });
});
