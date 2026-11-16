import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api-client';

const fetchMock = vi.fn<typeof fetch>();
let location: { href: string };

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  location = { href: 'http://localhost/tasks' };
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { location });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('api', () => {
  it('sends JSON and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { task: { id: '1' } }));

    const result = await api('/api/tasks', { method: 'POST', body: '{"title":"T"}' });

    expect(result).toEqual({ task: { id: '1' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      body: '{"title":"T"}',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('keeps headers passed by the caller', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api('/api/tasks', { headers: { 'X-Test': 'yes' } });

    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'Content-Type': 'application/json', 'X-Test': 'yes' });
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await api('/api/tasks/1', { method: 'DELETE' })).toBeUndefined();
  });

  it('throws an ApiError carrying the status, server message and field issues', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'Title is required', issues: { title: ['Title is required'] } }),
    );

    const error = await caught(api('/api/tasks', { method: 'POST', body: '{}' }));

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Title is required');
    expect(error.issues).toEqual({ title: ['Title is required'] });
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await caught(api('/api/tasks'));

    expect(error.status).toBe(502);
    expect(error.message).toBe('Something went wrong');
    expect(error.issues).toBeUndefined();
  });

  it('sends the user to /login when a session expires mid-use, without surfacing an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));

    // The promise never settles, so no error message flashes and no optimistic update rolls back while the page unloads.
    const outcome = await Promise.race([
      api('/api/tasks').then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise((r) => setTimeout(() => r('still pending'), 50)),
    ]);

    expect(location.href).toBe('/login');
    expect(outcome).toBe('still pending');
  });

  it('does not redirect on a 401 from the auth endpoints (e.g. a wrong password)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Invalid email or password' }));

    const error = await caught(api('/api/auth/login', { method: 'POST', body: '{}' }));

    expect(location.href).toBe('http://localhost/tasks');
    expect(error.message).toBe('Invalid email or password');
  });

  it('does not redirect on other errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'Not found' }));

    await caught(api('/api/tasks/nope', { method: 'PATCH', body: '{}' }));

    expect(location.href).toBe('http://localhost/tasks');
  });
});
