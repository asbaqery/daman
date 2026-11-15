import type { NextRequest } from 'next/server';
import { markShipped } from '@/lib/dealService';
import { dealAction } from '@/lib/routeHelpers';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return dealAction(req, params, 'deals:ship', async (user, id) => {
    await markShipped(id, user.id);
    return json({ status: 'shipped' });
  });
}
