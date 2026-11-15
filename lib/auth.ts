import 'server-only';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { connectDB } from './db';
import { User } from '../models/User';
import { SESSION_COOKIE, verifySessionToken } from './jwt';
import type { SessionUser } from './types';

export type Session =
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous' }
  /** كان هناك كوكي لكنه مزوّر/منتهي/لمستخدم محذوف */
  | { status: 'invalid'; reason: 'invalid' | 'expired' | 'user-missing' };

/**
 * المساعد المشترك للمصادقة:
 * يقرأ JWT من الكوكي httpOnly، يتحقق من التوقيع والانتهاء، ثم يتأكد أن المستخدم ما زال موجودًا.
 * يرمي MissingSecretError / DatabaseUnavailableError ليعالجها المستدعي برسالة واضحة.
 */
export async function resolveSession(token: string | undefined): Promise<Session> {
  if (!token) return { status: 'anonymous' };
  const v = await verifySessionToken(token);
  if (!v.ok) return { status: 'invalid', reason: v.reason };
  await connectDB();
  const u = await User.findById(v.userId, 'name email').lean<{ _id: { toString(): string }; name: string; email: string }>();
  if (!u) return { status: 'invalid', reason: 'user-missing' };
  return { status: 'authenticated', user: { id: u._id.toString(), name: u.name, email: u.email } };
}

/** لمسارات API: الكوكي من الطلب نفسه */
export const getSessionFromRequest = (req: NextRequest) => resolveSession(req.cookies.get(SESSION_COOKIE)?.value);

/** لمكونات الخادم والصفحات */
export async function getSession(): Promise<Session> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}
