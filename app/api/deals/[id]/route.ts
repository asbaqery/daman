import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDeal, publicView } from '@/lib/dealService';
import { apiError, handleRouteError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** صفحة الصفقة من الرابط: أي أحد يشوف المنتج والسعر والحالة، بدون بيانات الأطراف */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deal = await getDeal(id);
    if (!deal) return apiError(404, 'not_found', { code: 'not_found' });
    const s = await getSessionFromRequest(req);
    return json({ deal: publicView(deal, s.status === 'authenticated' ? s.user.id : null) });
  } catch (err) {
    return handleRouteError('deals:get', err);
  }
}
