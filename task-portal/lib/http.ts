import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export const validationError = (error: z.ZodError) =>
  NextResponse.json(
    { error: error.issues[0]?.message ?? 'Validation failed', issues: z.flattenError(error).fieldErrors },
    { status: 400 },
  );

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
export const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
