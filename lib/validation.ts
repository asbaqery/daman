/**
 * تحقق نقي من مدخلات الحساب — يُستخدم في الواجهة (رسائل فورية) وعلى الخادم (المصدر الموثوق).
 */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;
export type Result<T, K extends string> = { ok: true; data: T } | { ok: false; errors: FieldErrors<K> };

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
/** bcrypt يتجاهل ما بعد 72 بايت — نرفض الأطول بدل الاقتطاع الصامت */
export const PASSWORD_MAX_BYTES = 72;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const byteLength = (s: string) => new TextEncoder().encode(s).length;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

function checkEmail(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'اكتب الإيميل.';
  const e = normalizeEmail(raw);
  if (e.length > EMAIL_MAX || !EMAIL_RE.test(e)) return 'الإيميل مو صحيح.';
  return null;
}

function checkNewPassword(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return 'اكتب كلمة المرور.';
  if ([...raw].length < PASSWORD_MIN) return `كلمة المرور ${PASSWORD_MIN} أحرف أو أكثر.`;
  if (byteLength(raw) > PASSWORD_MAX_BYTES) return 'كلمة المرور طويلة وايد (الحد 72 بايت).';
  return null;
}

export type SignupField = 'name' | 'email' | 'password';
export interface SignupData { name: string; email: string; password: string }

export function validateSignup(input: unknown): Result<SignupData, SignupField> {
  const body = isObject(input) ? input : {};
  const errors: FieldErrors<SignupField> = {};
  const { name, email, password } = body;
  if (typeof name !== 'string' || name.trim().length < NAME_MIN) errors.name = 'اكتب اسمك (حرفين على الأقل).';
  else if (name.trim().length > NAME_MAX) errors.name = `الاسم طويل (الحد ${NAME_MAX} حرف).`;
  const emailErr = checkEmail(email);
  if (emailErr) errors.email = emailErr;
  const passErr = checkNewPassword(password);
  if (passErr) errors.password = passErr;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { name: (name as string).trim().replace(/\s+/g, ' '), email: normalizeEmail(email as string), password: password as string } };
}

export type LoginField = 'email' | 'password';
export interface LoginData { email: string; password: string }

export function validateLogin(input: unknown): Result<LoginData, LoginField> {
  const body = isObject(input) ? input : {};
  const errors: FieldErrors<LoginField> = {};
  const emailErr = checkEmail(body.email);
  if (emailErr) errors.email = emailErr;
  if (typeof body.password !== 'string' || body.password.length === 0) errors.password = 'اكتب كلمة المرور.';
  else if (byteLength(body.password) > PASSWORD_MAX_BYTES) errors.password = 'الإيميل أو كلمة المرور غلط.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { email: normalizeEmail(body.email as string), password: body.password as string } };
}
