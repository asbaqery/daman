import type { NextRequest } from 'next/server';
import { cancel } from '@/lib/dealService';
import { dealAction } from '@/lib/routeHelpers';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return dealAction(req, params, 'deals:cancel', async (user, id) => {
    await cancel(id, user.id);
    return json({ status: 'cancelled' });
  });
}
