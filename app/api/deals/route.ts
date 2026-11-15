import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { isSameOriginRequest } from '@/lib/csrf';
import { createDeal, listMine } from '@/lib/dealService';
import { validateDeal } from '@/lib/deals';
import { apiError, handleRouteError, json, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** صفقات المستخدم كبائع أو مشتري */
export async function GET(req: NextRequest) {
  try {
    const s = await getSessionFromRequest(req);
    if (s.status !== 'authenticated') return apiError(401, 'سجّل الدخول للمتابعة.', { code: 'not_authenticated' });
    return json({ deals: await listMine(s.user.id) });
  } catch (err) {
    return handleRouteError('deals:list', err);
  }
}

/** صفقة جديدة: البائع من الجلسة، والحالة تبدأ «بانتظار الدفع» دايمًا */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req.headers)) return apiError(403, 'طلب مرفوض.', { code: 'forbidden_origin' });
  try {
    const s = await getSessionFromRequest(req);
    if (s.status !== 'authenticated') return apiError(401, 'سجّل الدخول للمتابعة.', { code: 'not_authenticated' });
    const body = (await readJson(req)) as Record<string, unknown> | null;
    if (!body) return apiError(400, 'صيغة الطلب غير صحيحة.', { code: 'bad_request' });
    // السعر عدد صحيح بالفلس بس: ما نقرّب أي كسور بصمت
    if (!Number.isSafeInteger(body.price_fils)) return apiError(400, 'اكتب السعر بالدينار بين 1 و1000، مثل 25.500', { code: 'invalid' });
    const v = validateDeal({
      shop_name: String(body.shop_name ?? ''),
      title: String(body.title ?? ''),
      description: String(body.description ?? ''),
      price: typeof body.price_fils === 'number' ? (body.price_fils / 1000).toFixed(3) : '',
    });
    if (!v.ok) return apiError(400, v.error, { code: 'invalid' });
    return json(await createDeal(s.user.id, v.value), 201);
  } catch (err) {
    return handleRouteError('deals:create', err);
  }
}
