import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/jwt';
import { handleRouteError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const s = await getSessionFromRequest(req);
    if (s.status === 'authenticated') return json({ user: s.user });
    const res = json({ user: null, ...(s.status === 'invalid' ? { reason: s.reason } : {}) }, 401);
    // جلسة منتهية أو مزوّرة: نحذف الكوكي حتى لا تبقى عالقة
    if (s.status === 'invalid') res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  } catch (err) {
    return handleRouteError('me', err);
  }
}
