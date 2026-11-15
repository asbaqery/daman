/** سر مطلوب غير مضاف في Replit Secrets — الرسالة تذكر اسم المتغير فقط، لا قيمته */
export class MissingSecretError extends Error {
  constructor(public secret: 'MONGODB_URI' | 'JWT_SECRET' | 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET' | 'APP_ORIGIN', detail?: string) {
    super(`Missing or invalid secret ${secret}${detail ? `: ${detail}` : ''}. Add it to the server environment variables.`);
    this.name = 'MissingSecretError';
  }
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super('Database connection failed');
    this.name = 'DatabaseUnavailableError';
  }
}

/** تسجيل آمن: اسم الخطأ ورمزه فقط — بدون رسائل قد تتضمن عناوين اتصال أو بيانات */
export function logServerError(scope: string, err: unknown) {
  if (err instanceof MissingSecretError) {
    console.error(`[${scope}] ${err.message}`);
    return;
  }
  const e = err as { name?: string; code?: string | number };
  console.error(`[${scope}] ${e?.name ?? 'Error'}${e?.code != null ? ` (code ${e.code})` : ''}`);
}
