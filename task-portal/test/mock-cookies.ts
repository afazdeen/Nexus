// Stand-in for `next/headers` in tests, since the real one only works inside a Next request.
// Use with: vi.mock('next/headers', () => import('@/test/mock-cookies'));
type StoredCookie = { value: string; options?: Record<string, unknown> };

export const jar = new Map<string, StoredCookie>();

export async function cookies() {
  return {
    get: (name: string) => {
      const cookie = jar.get(name);
      return cookie ? { name, value: cookie.value } : undefined;
    },
    has: (name: string) => jar.has(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      jar.set(name, { value, options });
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  };
}
