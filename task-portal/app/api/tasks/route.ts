import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { createTaskSchema } from '@/lib/validators';
import { TASK_STATUSES } from '@/lib/constants';
import { readJson, unauthorized, validationError } from '@/lib/http';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const status = z.enum(TASK_STATUSES).safeParse(req.nextUrl.searchParams.get('status'));
  const where = status.success
    ? and(eq(tasks.userId, user.id), eq(tasks.status, status.data))
    : eq(tasks.userId, user.id);

  const rows = await db.select().from(tasks).where(where).orderBy(desc(tasks.createdAt));
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = createTaskSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  const [task] = await db
    .insert(tasks)
    .values({ ...parsed.data, userId: user.id }) // userId always comes from the session, never from the body
    .returning();

  return NextResponse.json({ task }, { status: 201 });
}
