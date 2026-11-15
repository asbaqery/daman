import type { NextRequest } from 'next/server';
import { release } from '@/lib/dealService';
import { dealAction } from '@/lib/routeHelpers';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return dealAction(req, params, 'deals:release', async (user, id) => {
    await release(id, user.id);
    return json({ status: 'released' });
  });
}
