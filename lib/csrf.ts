/**
 * حماية CSRF للعمليات اللي تغيّر البيانات (POST):
 * المتصفح يرسل Origin مع طلبات POST، وموقع ثاني ما يقدر يزوّره.
 * - إذا APP_ORIGIN مضبوط (في النشر): لازم Origin يطابقه بالضبط.
 * - وإلا: مضيف Origin لازم يطابق مضيف الطلب نفسه.
 * - بدون Origin: نقبل بس Sec-Fetch-Site: same-origin.
 */
export function isSameOriginRequest(headers: Headers, env: { APP_ORIGIN?: string } = { APP_ORIGIN: process.env.APP_ORIGIN }): boolean {
  const origin = headers.get('origin');
  if (!origin || origin === 'null') return headers.get('sec-fetch-site') === 'same-origin';
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  const configured = (env.APP_ORIGIN ?? '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  if (configured.length) return configured.includes(originUrl.origin);
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0].trim().toLowerCase();
  return !!host && originUrl.host.toLowerCase() === host;
}

/**
 * أصل روابط العودة من Stripe: APP_ORIGIN.
 * رؤوس الطلب يتحكم فيها أي عميل، فما نبني منها رابط في الإنتاج إلا لتشغيل محلي.
 * null يعني إن الدفع مو مضبوط على هالخادم.
 */
export function returnOrigin(requestOrigin: string, env: { APP_ORIGIN?: string; NODE_ENV?: string } = process.env): string | null {
  const configured = (env.APP_ORIGIN ?? '').split(',')[0].trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (env.NODE_ENV !== 'production') return requestOrigin;
  try {
    const { hostname } = new URL(requestOrigin);
    return hostname === 'localhost' || hostname === '127.0.0.1' ? requestOrigin : null;
  } catch {
    return null;
  }
}
