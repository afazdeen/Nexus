import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { unauthorized } from '@/lib/http';

export async function GET() {
  const user = await getCurrentUser();
  return user ? NextResponse.json({ user }) : unauthorized();
}
