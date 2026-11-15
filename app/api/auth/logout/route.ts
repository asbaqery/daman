import type { NextRequest } from 'next/server';
import { isSameOriginRequest } from '@/lib/csrf';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/jwt';
import { apiError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req.headers)) return apiError(403, 'طلب مرفوض.');
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
