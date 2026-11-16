import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { createTaskSchema, taskListQuerySchema } from '@/lib/validators';
import { readJson, unauthorized, validationError } from '@/lib/http';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const query = taskListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) return validationError(query.error);
  const { status } = query.data;
  const where = status ? and(eq(tasks.userId, user.id), eq(tasks.status, status)) : eq(tasks.userId, user.id);

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
