import 'server-only';
import { NextResponse } from 'next/server';
import { DatabaseUnavailableError, MissingSecretError, logServerError } from './errors';

const PRIVATE = { 'Cache-Control': 'private, no-store, max-age=0' };

/** كل استجابات API خاصة ولا تُخزَّن في cache مشترك */
export function json(data: unknown, status = 200, init?: { headers?: Record<string, string> }) {
  return NextResponse.json(data, { status, headers: { ...PRIVATE, ...init?.headers } });
}

export const apiError = (status: number, error: string, extra?: Record<string, unknown>) => json({ error, ...extra }, status);

/** يقرأ JSON بحد أقصى للحجم — يرجع null عند الصيغة الخاطئة */
export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown | null> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('application/json')) return null;
  const text = await req.text();
  if (!text || text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** تحويل الأخطاء غير المتوقعة إلى رسالة عامة دون كشف التفاصيل الداخلية */
export function handleRouteError(scope: string, err: unknown) {
  logServerError(scope, err);
  if (err instanceof MissingSecretError) {
    const hint = process.env.NODE_ENV === 'production' ? undefined : `أضف ${err.secret} في متغيرات البيئة على الخادم ثم أعد تشغيل الخادم.`;
    return apiError(500, 'الخادم غير مُعدّ بالكامل بعد.', hint ? { hint } : undefined);
  }
  if (err instanceof DatabaseUnavailableError) return apiError(500, 'تعذر الاتصال بقاعدة البيانات. حاول بعد قليل.');
  return apiError(500, 'حدث خطأ غير متوقع. حاول مرة أخرى.');
}

export const isDuplicateKeyError = (err: unknown) => (err as { code?: number })?.code === 11000;
