import type { NextRequest } from 'next/server';
import { returnOrigin } from '@/lib/csrf';
import { startCheckout } from '@/lib/dealService';
import { dealAction } from '@/lib/routeHelpers';
import { apiError, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return dealAction(req, params, 'deals:checkout', async (user, id) => {
    const origin = returnOrigin(req.headers.get('origin') ?? req.nextUrl.origin);
    if (!origin) return apiError(500, 'payments_not_configured', { code: 'payments_not_configured' });
    return json({ url: await startCheckout(id, user, origin) }, 201);
  });
}
