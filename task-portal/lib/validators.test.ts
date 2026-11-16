import { describe, expect, it } from 'vitest';
import { createTaskSchema, loginSchema, registerSchema, updateTaskSchema } from '@/lib/validators';

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('registerSchema', () => {
  const valid = { name: 'Ada', email: 'ada@example.com', password: 'password123' };

  it('trims the name and normalises the email to lower case', () => {
    const result = registerSchema.parse({ ...valid, name: '  Ada  ', email: '  Ada@Example.COM ' });

    expect(result).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'password123' });
  });

  it('does not trim the password', () => {
    expect(registerSchema.parse({ ...valid, password: ' secret pw ' }).password).toBe(' secret pw ');
  });

  it.each([
    ['a blank name', { name: '   ' }, 'Name is required'],
    ['an invalid email', { email: 'not-an-email' }, 'Enter a valid email address'],
    ['a short password', { password: '1234567' }, 'Password must be at least 8 characters'],
  ])('rejects %s', (_label, override, message) => {
    const result = registerSchema.safeParse({ ...valid, ...override });

    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe(message);
  });

  it('rejects a password over 128 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('normalises the email so login matches the stored lower-case address', () => {
    expect(loginSchema.parse({ email: ' ADA@example.com', password: 'x' }).email).toBe('ada@example.com');
  });

  it('only requires a password to be present (no length rule at login)', () => {
    expect(loginSchema.safeParse({ email: 'ada@example.com', password: 'x' }).success).toBe(true);
    expect(firstMessage(loginSchema.safeParse({ email: 'ada@example.com', password: '' }))).toBe(
      'Password is required',
    );
  });
});

describe('createTaskSchema', () => {
  it('applies defaults when only a title is given', () => {
    expect(createTaskSchema.parse({ title: '  Write tests  ' })).toEqual({
      title: 'Write tests',
      status: 'todo',
      priority: 'medium',
    });
  });

  it('accepts a full task', () => {
    const input = {
      title: 'Ship',
      description: 'Phase 2',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-12-31',
    };

    expect(createTaskSchema.parse(input)).toEqual(input);
  });

  it('accepts null for the optional fields', () => {
    const result = createTaskSchema.parse({ title: 'T', description: null, dueDate: null });

    expect(result).toMatchObject({ description: null, dueDate: null });
  });

  it.each([
    ['a blank title', { title: '   ' }, 'Title is required'],
    ['a dd/mm/yyyy due date', { title: 'T', dueDate: '31/12/2026' }, 'Use YYYY-MM-DD'],
    ['an impossible due date', { title: 'T', dueDate: '2026-13-01' }, 'Use YYYY-MM-DD'],
  ])('rejects %s', (_label, input, message) => {
    expect(firstMessage(createTaskSchema.safeParse(input))).toBe(message);
  });

  it.each([
    ['a title over 200 characters', { title: 'x'.repeat(201) }],
    ['a description over 2000 characters', { title: 'T', description: 'x'.repeat(2001) }],
    ['an unknown status', { title: 'T', status: 'blocked' }],
    ['an unknown priority', { title: 'T', priority: 'urgent' }],
  ])('rejects %s', (_label, input) => {
    expect(createTaskSchema.safeParse(input).success).toBe(false);
  });

  it('drops fields it does not know about, such as userId', () => {
    const result = createTaskSchema.parse({ title: 'T', userId: 'someone-else', id: 'x' });

    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('id');
  });
});

describe('updateTaskSchema', () => {
  it('does not add defaults for fields that were not sent', () => {
    // The pitfall from the guide: a partial create schema would reset status to "todo" here.
    expect(updateTaskSchema.parse({ title: 'Renamed' })).toEqual({ title: 'Renamed' });
  });

  it('accepts a status-only change', () => {
    expect(updateTaskSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
  });

  it('lets fields be cleared with null', () => {
    expect(updateTaskSchema.parse({ description: null, dueDate: null })).toEqual({ description: null, dueDate: null });
  });

  it('rejects an empty update', () => {
    expect(firstMessage(updateTaskSchema.safeParse({}))).toBe('Nothing to update');
  });

  it('rejects an update that only contains unknown fields', () => {
    expect(firstMessage(updateTaskSchema.safeParse({ userId: 'someone-else' }))).toBe('Nothing to update');
  });

  it('still validates the fields that are sent', () => {
    expect(updateTaskSchema.safeParse({ status: 'blocked' }).success).toBe(false);
    expect(firstMessage(updateTaskSchema.safeParse({ title: '' }))).toBe('Title is required');
  });
});
