import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, webhookSecret } from '@/lib/stripe';
import { handleStripeEvent } from '@/lib/dealService';
import { logServerError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Stripe يرسل هنا. الجسم الخام ضروري للتحقق من التوقيع */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return reply({ error: 'missing signature' }, 400);
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, webhookSecret());
  } catch (err) {
    if ((err as Error).name === 'MissingSecretError') {
      logServerError('webhook', err);
      return reply({ error: 'not configured' }, 500);
    }
    return reply({ error: 'invalid signature' }, 400);
  }
  try {
    const r = await handleStripeEvent(event);
    return reply(r.body, r.status);
  } catch (err) {
    logServerError('webhook', err);
    return reply({ error: 'server error' }, 500); // Stripe يعيد المحاولة
  }
}
