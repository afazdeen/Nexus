import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import nextConfig from '@/next.config';
import { SESSION_COOKIE } from '@/lib/constants';
import { config, proxy } from './proxy';

describe('proxy matcher', () => {
  it.each(['/tasks', '/tasks/123'])('runs on %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(true);
  });

  // The proxy must never touch the auth pages (redirect-loop pitfall), the API, or static assets.
  it.each(['/', '/login', '/register', '/api/tasks', '/api/auth/me', '/_next/static/chunk.js', '/favicon.ico'])(
    'does not run on %s',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(false);
    },
  );
});

describe('proxy', () => {
  it('redirects to /login when there is no session cookie', () => {
    const res = proxy(new NextRequest('http://localhost:3000/tasks'));

    expect(getRedirectUrl(res)).toBe('http://localhost:3000/login');
  });

  it('lets the request through when a session cookie is present, without validating it', () => {
    // Validation happens in the (portal) layout; the proxy is only an optimistic check.
    const req = new NextRequest('http://localhost:3000/tasks', { headers: { cookie: `${SESSION_COOKIE}=anything` } });
    const res = proxy(req);

    expect(getRedirectUrl(res)).toBeNull();
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});
