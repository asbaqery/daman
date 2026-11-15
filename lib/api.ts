import type { DealInput, DealListItem, DealView } from './deals';

/** طلبات الواجهة لخادم الموقع نفسه. الكوكي httpOnly ينرسل تلقائي */
async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(String(data.code ?? data.error ?? `http_${res.status}`)) as Error & { status?: number; fields?: unknown };
    err.status = res.status;
    err.fields = data.fields;
    throw err;
  }
  return data as T;
}

export const dealsApi = {
  create: (input: DealInput) => call<{ id: string }>('/api/deals', { method: 'POST', body: input }),
  mine: async () => (await call<{ deals: DealListItem[] }>('/api/deals')).deals,
  get: async (id: string) => {
    try {
      return (await call<{ deal: DealView }>(`/api/deals/${id}`)).deal;
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  },
  markShipped: async (id: string) => { await call(`/api/deals/${id}/ship`, { method: 'POST' }); },
  cancelUnpaid: async (id: string) => { await call(`/api/deals/${id}/cancel`, { method: 'POST' }); },
  startCheckout: async (id: string) => (await call<{ url: string }>(`/api/deals/${id}/checkout`, { method: 'POST' })).url,
  act: async (id: string, action: 'release' | 'cancel') => { await call(`/api/deals/${id}/${action}`, { method: 'POST' }); },
};

export type DealsApi = typeof dealsApi;

/** رسائل عربية واضحة */
export function friendlyError(err: unknown): string {
  const msg = `${(err as { name?: string })?.name ?? ''} ${String((err as { message?: string })?.message ?? err ?? '')}`;
  if (/own_deal/.test(msg)) return 'هذي صفقتك إنت، ما تقدر تشتريها.';
  if (/reserved/.test(msg)) return 'في مشتري قاعد يدفع هالصفقة الحين. جرب بعد شوي.';
  if (/not_available|bad_state|stripe_conflict|not_allowed/.test(msg)) return 'حالة الصفقة تغيرت. حدّثنا الصفحة.';
  if (/forbidden/.test(msg)) return 'ما تقدر تسوي هالخطوة.';
  if (/not_found/.test(msg)) return 'ما لقينا هالصفقة.';
  if (/not_authenticated|http_401/.test(msg)) return 'انتهت جلستك. سجّل دخول مرة ثانية.';
  if (/payments_not_configured/.test(msg)) return 'الدفع مو مضبوط على الخادم للحين.';
  if (/failed to fetch|load failed|network/i.test(msg)) return 'ما قدرنا نوصل للسيرفر. شيك على الإنترنت.';
  return 'صار خطأ. جرب مرة ثانية.';
}
