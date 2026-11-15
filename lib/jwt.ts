import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { MissingSecretError } from './errors';

export const SESSION_COOKIE = 'daman_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 أيام — نفس مدة الكوكي
const ALG = 'HS256';
const ISSUER = 'daman';
const AUDIENCE = 'daman-web';
const MIN_SECRET_LENGTH = 32;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new MissingSecretError('JWT_SECRET');
  if (secret.length < MIN_SECRET_LENGTH) throw new MissingSecretError('JWT_SECRET', `must be at least ${MIN_SECRET_LENGTH} characters`);
  return new TextEncoder().encode(secret);
}

/** التوكن يحمل معرّف المستخدم في sub فقط — لا كلمة مرور ولا hash */
export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export type VerifyResult = { ok: true; userId: string } | { ok: false; reason: 'invalid' | 'expired' };

/** تحقق كامل: التوقيع، الخوارزمية HS256 فقط، المُصدِر، الجمهور، ووقت الانتهاء */
export async function verifySessionToken(token: string): Promise<VerifyResult> {
  const key = secretKey(); // يرمي MissingSecretError خارج try حتى لا تُعامل كجلسة غير صالحة
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG], issuer: ISSUER, audience: AUDIENCE });
    if (typeof payload.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(payload.sub)) return { ok: false, reason: 'invalid' };
    return { ok: true, userId: payload.sub };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'invalid' };
  }
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
});
