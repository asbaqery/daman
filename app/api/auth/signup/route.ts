import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { validateSignup } from '@/lib/validation';
import { isSameOriginRequest } from '@/lib/csrf';
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from '@/lib/jwt';
import { apiError, handleRouteError, isDuplicateKeyError, json, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';
const BCRYPT_COST = 12;
const DUPLICATE = 'هذا البريد مسجّل مسبقًا. سجّل الدخول أو استخدم بريدًا آخر.';

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req.headers)) return apiError(403, 'طلب مرفوض.');
  const body = await readJson(req);
  if (body === null) return apiError(400, 'صيغة الطلب غير صحيحة.');

  const v = validateSignup(body);
  if (!v.ok) return apiError(400, 'تحقق من الحقول المظللة.', { fields: v.errors });

  try {
    await connectDB();
    await User.init(); // يضمن بناء الفهرس الفريد على البريد قبل أول إدراج
    const passwordHash = await bcrypt.hash(v.data.password, BCRYPT_COST);
    const user = await User.create({ name: v.data.name, email: v.data.email, passwordHash });
    // نسجّل دخوله مباشرة بعد إنشاء الحساب
    const token = await signSessionToken(user._id.toString());
    const res = json({ user: { id: user._id.toString(), name: user.name, email: user.email } }, 201);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    // الفهرس الفريد هو الضمان الحقيقي ضد التكرار (حتى مع طلبين متزامنين)
    if (isDuplicateKeyError(err)) return apiError(409, DUPLICATE, { fields: { email: DUPLICATE } });
    return handleRouteError('signup', err);
  }
}
