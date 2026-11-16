import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { notFound, readJson, unauthorized, validationError } from '@/lib/http';

const post = (body: string) => new Request('http://localhost/api', { method: 'POST', body });

describe('readJson', () => {
  it('returns the parsed body', async () => {
    expect(await readJson(post('{"title":"T"}'))).toEqual({ title: 'T' });
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['an empty body', ''],
  ])('returns undefined for %s instead of throwing', async (_label, body) => {
    expect(await readJson(post(body))).toBeUndefined();
  });
});

describe('validationError', () => {
  it('returns 400 with the first message and per-field issues', async () => {
    const schema = z.object({ title: z.string().min(1, 'Title is required'), status: z.enum(['todo']) });
    const result = schema.safeParse({ title: '', status: 'nope' });
    if (result.success) throw new Error('expected validation to fail');

    const res = validationError(result.error);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Title is required');
    expect(body.issues.title).toEqual(['Title is required']);
    expect(body.issues.status).toHaveLength(1);
  });
});

describe('error responses', () => {
  it('unauthorized returns 401', async () => {
    const res = unauthorized();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('notFound returns 404', async () => {
    const res = notFound();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
