import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { loginSchema } from '@/lib/validators';
import { readJson, validationError } from '@/lib/http';

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  const user = await db.select().from(users).where(eq(users.email, email)).get();

  let ok = false;
  if (user) ok = await verifyPassword(password, user.passwordHash);
  // Hash anyway when the user doesn't exist, so the response time doesn't reveal which emails are registered.
  else await hashPassword(password);

  if (!user || !ok) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
