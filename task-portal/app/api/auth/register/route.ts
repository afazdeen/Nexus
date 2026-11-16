import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { registerSchema } from '@/lib/validators';
import { readJson, validationError } from '@/lib/http';

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const { name, email, password } = parsed.data;

  // Let the unique index decide instead of checking first: two sign-ups racing for one email
  // would both pass a check, and the second insert would then fail with a 500.
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, name: users.name, email: users.email });

  if (!user) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  await createSession(user.id); // log in straight after sign-up
  return NextResponse.json({ user }, { status: 201 });
}
