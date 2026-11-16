import { z } from 'zod';

export class ApiError extends Error {
  status: number;
  issues?: Record<string, string[]>;
  constructor(status: number, message: string, issues?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

// Error bodies come from our own handlers, but a proxy or crash can return anything, so check the shape.
const errorBodySchema = z.object({
  error: z.string().optional(),
  issues: z.record(z.string(), z.array(z.string())).optional(),
});

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers });

  // If the session expires mid-use, send the user back to login (except on the auth endpoints themselves).
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    // A full reload is deliberate: it also throws away every cached query from the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login';
    // Never settle: the page is unloading, so don't flash an error message or roll anything back meanwhile.
    return new Promise<T>(() => {});
  }

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(await res.json().catch(() => null));
    const body = parsed.success ? parsed.data : undefined;
    throw new ApiError(res.status, body?.error ?? 'Something went wrong', body?.issues);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}
