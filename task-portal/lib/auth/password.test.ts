import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('hashPassword', () => {
  it('returns a hex salt and a 64-byte hex hash', async () => {
    const stored = await hashPassword('password123');

    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(stored).not.toContain('password123');
  });

  it('uses a fresh salt each time, so the same password hashes differently', async () => {
    const [a, b] = await Promise.all([hashPassword('password123'), hashPassword('password123')]);

    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('accepts the right password', async () => {
    const stored = await hashPassword('password123');

    expect(await verifyPassword('password123', stored)).toBe(true);
  });

  it('rejects a wrong password, including one that differs only by case', async () => {
    const stored = await hashPassword('password123');

    expect(await verifyPassword('password124', stored)).toBe(false);
    expect(await verifyPassword('PASSWORD123', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('handles non-ASCII passwords', async () => {
    const stored = await hashPassword('pässwörd 🔑');

    expect(await verifyPassword('pässwörd 🔑', stored)).toBe(true);
    expect(await verifyPassword('passwort 🔑', stored)).toBe(false);
  });

  it.each([
    ['empty string', ''],
    ['no separator', 'abcdef'],
    ['missing hash', 'abcdef:'],
    ['missing salt', ':abcdef'],
    ['hash that is not hex', 'abcd:zz'],
    ['hash of the wrong length', 'abcd:abcd'],
  ])('returns false (never throws or matches) for a malformed stored value: %s', async (_label, stored) => {
    expect(await verifyPassword('any-password', stored)).toBe(false);
  });
});
