import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
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

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id, name: users.name, email: users.email });

  await createSession(user.id); // log in straight after sign-up
  return NextResponse.json({ user }, { status: 201 });
}
