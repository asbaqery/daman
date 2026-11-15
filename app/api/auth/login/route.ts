import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { validateLogin } from '@/lib/validation';
import { isSameOriginRequest } from '@/lib/csrf';
import { SESSION_COOKIE, sessionCookieOptions, signSessionToken } from '@/lib/jwt';
import { apiError, handleRouteError, json, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';
const GENERIC = 'البريد أو كلمة المرور غير صحيحة.';

// hash لكلمة عشوائية تُولَّد مرة عند تشغيل الخادم: نقارن به حين لا يوجد المستخدم
// حتى يستغرق الرد نفس الوقت تقريبًا في الحالتين (لا يكشف أي البريدين مسجّل)
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash(crypto.randomUUID(), 12));

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req.headers)) return apiError(403, 'طلب مرفوض.');
  const body = await readJson(req);
  if (body === null) return apiError(400, 'صيغة الطلب غير صحيحة.');

  const v = validateLogin(body);
  if (!v.ok) return apiError(400, 'تحقق من الحقول المظللة.', { fields: v.errors });

  try {
    await connectDB();
    const user = await User.findOne({ email: v.data.email }).select('+passwordHash name email');
    const valid = await bcrypt.compare(v.data.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) return apiError(401, GENERIC);

    const token = await signSessionToken(user._id.toString());
    // التوكن في كوكي httpOnly فقط — لا يُرجع في JSON
    const res = json({ user: { id: user._id.toString(), name: user.name, email: user.email } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    return handleRouteError('login', err);
  }
}
