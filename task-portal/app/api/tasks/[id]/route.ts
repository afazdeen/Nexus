import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { getCurrentUser } from '@/lib/auth/session';
import { updateTaskSchema } from '@/lib/validators';
import { notFound, readJson, unauthorized, validationError } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const parsed = updateTaskSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  const [task] = await db
    .update(tasks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id))) // ownership is checked in the same query
    .returning();

  return task ? NextResponse.json({ task }) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .returning({ id: tasks.id });

  return deleted.length ? new NextResponse(null, { status: 204 }) : notFound();
}
