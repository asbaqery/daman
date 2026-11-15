import 'server-only';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from './auth';
import { isSameOriginRequest } from './csrf';
import { DealError } from './dealService';
import { apiError, handleRouteError } from './http';
import type { SessionUser } from './types';

type Handler = (user: SessionUser, id: string) => Promise<Response>;

/** خطوة على صفقة: حماية CSRF + جلسة مطلوبة + أخطاء الصفقة برموز واضحة */
export async function dealAction(req: NextRequest, params: Promise<{ id: string }>, scope: string, fn: Handler) {
  if (!isSameOriginRequest(req.headers)) return apiError(403, 'طلب مرفوض.', { code: 'forbidden_origin' });
  try {
    const s = await getSessionFromRequest(req);
    if (s.status !== 'authenticated') return apiError(401, 'سجّل الدخول للمتابعة.', { code: 'not_authenticated' });
    const { id } = await params;
    return await fn(s.user, id);
  } catch (err) {
    if (err instanceof DealError) return apiError(err.status, err.code, { code: err.code });
    return handleRouteError(scope, err);
  }
}
