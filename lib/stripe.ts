import 'server-only';
import Stripe from 'stripe';
import { MissingSecretError } from './errors';

let client: Stripe | null = null;

/** Stripe بوضع الاختبار فقط: نرفض أي مفتاح Live */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) throw new MissingSecretError('STRIPE_SECRET_KEY', 'must be a Stripe test-mode key');
  client ??= new Stripe(key);
  return client;
}

export function webhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  if (!s.startsWith('whsec_')) throw new MissingSecretError('STRIPE_WEBHOOK_SECRET');
  return s;
}
