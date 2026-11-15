import 'server-only';
import { Types } from 'mongoose';
import type Stripe from 'stripe';
import { connectDB } from './db';
import { Deal, type DealDoc } from '../models/Deal';
import { getStripe } from './stripe';
import {
  CHARGE_CURRENCY, CHECKOUT_MINUTES, DEAL_TOKEN_RE, OBJECT_ID_RE, RESERVE_MINUTES, decideAction, decideCheckout, decideHold, statusAfterCancel,
  toChargeMinor, type DealRow, type DealStatus,
} from './logic';
import type { DealInput } from './deals';

/** خطأ متوقع برسالة/كود للواجهة (مو خطأ خادم) */
export class DealError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
    this.name = 'DealError';
  }
}

const oid = (id: string) => new Types.ObjectId(id);
const str = (v: unknown) => (v == null ? null : String(v));

function toRow(d: DealDoc): DealRow {
  return {
    id: d._id.toString(),
    seller_id: d.seller_id.toString(),
    buyer_id: str(d.buyer_id),
    price_fils: d.price_fils,
    status: d.status as DealStatus,
    reserved_until: d.reserved_until ? d.reserved_until.toISOString() : null,
    payment_intent_id: d.payment_intent_id ?? null,
  };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** اللي يشوفه أي أحد معه الرابط: المنتج والسعر والحالة، بدون بيانات الأطراف */
export function publicView(d: DealDoc, userId: string | null, now = new Date()) {
  const sellerId = d.seller_id.toString();
  const buyerId = str(d.buyer_id);
  return {
    id: d.public_token,
    shop_name: d.shop_name,
    title: d.title,
    description: d.description ?? null,
    price_fils: d.price_fils,
    status: d.status as DealStatus,
    created_at: iso(d.created_at)!,
    paid_at: iso(d.paid_at),
    shipped_at: iso(d.shipped_at),
    released_at: iso(d.released_at),
    cancelled_at: iso(d.cancelled_at),
    is_seller: userId !== null && sellerId === userId,
    is_buyer: userId !== null && buyerId === userId,
    reserved_by_other:
      d.status === 'awaiting_payment' && buyerId !== null && buyerId !== userId && !!d.reserved_until && d.reserved_until > now,
  };
}

/** الصفقة من رمز الرابط */
export async function getDeal(token: string): Promise<DealDoc | null> {
  if (!DEAL_TOKEN_RE.test(token)) return null;
  await connectDB();
  return Deal.findOne({ public_token: token }).lean<DealDoc>();
}

export async function createDeal(sellerId: string, input: DealInput) {
  await connectDB();
  const d = await Deal.create({ seller_id: oid(sellerId), ...input });
  return { id: d.public_token };
}

/** صفقات المستخدم كبائع أو مشتري فقط */
export async function listMine(userId: string) {
  await connectDB();
  const docs = await Deal.find({ $or: [{ seller_id: oid(userId) }, { buyer_id: oid(userId) }] })
    .sort({ created_at: -1 })
    .limit(100)
    .lean<DealDoc[]>();
  return docs.map((d) => ({
    id: d.public_token,
    shop_name: d.shop_name,
    title: d.title,
    price_fils: d.price_fils,
    status: d.status as DealStatus,
    created_at: iso(d.created_at)!,
    seller_id: d.seller_id.toString(),
    buyer_id: str(d.buyer_id),
  }));
}

/** يحجز الصفقة لمشتري واحد ويفتح صفحة دفع Stripe بحجز المبلغ بدون سحبه */
export async function startCheckout(token: string, user: { id: string; email: string }, origin: string): Promise<string> {
  const deal = await getDeal(token);
  if (!deal) throw new DealError('not_found', 404);
  const dealId = deal._id.toString();
  const now = new Date();
  const decision = decideCheckout(toRow(deal), user.id, now);
  if (!decision.ok) throw new DealError(decision.code, decision.status);

  const stripe = getStripe();
  // نفس المشتري وعنده جلسة مفتوحة: نرجّعه لها بدل ما نمدد الحجز بلا نهاية
  if (str(deal.buyer_id) === user.id && deal.stripe_session_id && deal.reserved_until && deal.reserved_until > now) {
    const open = await stripe.checkout.sessions.retrieve(deal.stripe_session_id).catch(() => null);
    if (open?.status === 'open' && open.url) return open.url;
  }

  // الحجز ذري: ينجح لمشتري واحد بس حتى لو ضغط اثنين بنفس اللحظة
  const reserved = await Deal.findOneAndUpdate(
    {
      _id: deal._id,
      status: 'awaiting_payment',
      seller_id: { $ne: oid(user.id) },
      $or: [{ buyer_id: null }, { buyer_id: oid(user.id) }, { reserved_until: { $lt: now } }],
    },
    { $set: { buyer_id: oid(user.id), reserved_until: new Date(now.getTime() + RESERVE_MINUTES * 60_000) } },
    { new: true },
  ).lean<DealDoc>();
  if (!reserved) throw new DealError('reserved', 409);

  const chargeAmount = toChargeMinor(deal.price_fils);
  let session: Stripe.Checkout.Session | null = null;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      expires_at: Math.floor(now.getTime() / 1000) + CHECKOUT_MINUTES * 60,
      customer_email: user.email,
      client_reference_id: dealId,
      metadata: { deal_id: dealId, buyer_id: user.id },
      payment_intent_data: {
        // الحجز: المبلغ يتجمد على البطاقة وما ينسحب إلا لما المشتري يأكد الاستلام
        capture_method: 'manual',
        metadata: { deal_id: dealId, buyer_id: user.id },
      },
      line_items: [{ quantity: 1, price_data: { currency: CHARGE_CURRENCY, unit_amount: chargeAmount, product_data: { name: deal.title } } }],
      success_url: `${origin}/d/${token}?paid=1`,
      cancel_url: `${origin}/d/${token}`,
    });
    const linked = await Deal.findOneAndUpdate(
      { _id: deal._id, buyer_id: oid(user.id), status: 'awaiting_payment' },
      { $set: { stripe_session_id: session.id, charge_amount: chargeAmount, charge_currency: CHARGE_CURRENCY } },
    );
    if (!linked || !session.url) throw new Error('could not link Stripe session');
    return session.url;
  } catch (err) {
    // الجلسة اللي سويناها ما ترتبطت: نسكرها عشان ما أحد يدفع فيها
    if (session) await stripe.checkout.sessions.expire(session.id).catch(() => null);
    // نفك الحجز بس إذا ما في جلسة قديمة مفتوحة لنفس المشتري (حدث انتهائها يفكه لاحقًا)
    await Deal.updateOne(
      { _id: deal._id, buyer_id: oid(user.id), status: 'awaiting_payment', stripe_session_id: null },
      { $set: { buyer_id: null, reserved_until: null } },
    );
    throw err;
  }
}

/** البائع يعلّم «تم الشحن» بس لما يكون المبلغ محجوز */
export async function markShipped(token: string, userId: string) {
  if (!DEAL_TOKEN_RE.test(token)) throw new DealError('not_found', 404);
  await connectDB();
  const d = await Deal.findOneAndUpdate(
    { public_token: token, seller_id: oid(userId), status: 'held' },
    { $set: { status: 'shipped', shipped_at: new Date() } },
  );
  if (!d) throw new DealError('not_allowed', 409);
}

/** المشتري يأكد الاستلام: ينسحب المبلغ المحجوز للبائع */
export async function release(token: string, userId: string) {
  const deal = await getDeal(token);
  if (!deal) throw new DealError('not_found', 404);
  const dealId = deal._id.toString();
  const decision = decideAction(toRow(deal), userId, 'release');
  if (!decision.ok) throw new DealError(decision.code, decision.status);
  try {
    await getStripe().paymentIntents.capture(deal.payment_intent_id!, {}, { idempotencyKey: `release-${dealId}` });
  } catch (err) {
    console.error('[release] stripe', (err as Error).name);
    throw new DealError('stripe_conflict', 409);
  }
  await Deal.updateOne({ _id: deal._id, status: { $in: ['held', 'shipped'] } }, { $set: { status: 'released', released_at: new Date() } });
}

/**
 * الإلغاء حسب الطرف والحالة:
 * - البائع وما في دفع: يلغي الصفقة (إلا إذا في مشتري قاعد يدفع الحين).
 * - المشتري قبل الشحن، أو البائع قبل التحويل: نفك الحجز فيرجع المبلغ كامل.
 */
export async function cancel(token: string, userId: string) {
  const deal = await getDeal(token);
  if (!deal) throw new DealError('not_found', 404);
  const dealId = deal._id.toString();
  const isSeller = deal.seller_id.toString() === userId;

  if (deal.status === 'awaiting_payment') {
    if (!isSeller) throw new DealError('forbidden', 403);
    // أحد فتح صفحة الدفع وتركها: نسكر جلسته عشان البائع يقدر يلغي، إلا إذا الدفع قاعد يكتمل
    if (deal.stripe_session_id && deal.reserved_until && deal.reserved_until > new Date()) {
      const stripe = getStripe();
      const open = await stripe.checkout.sessions.retrieve(deal.stripe_session_id).catch(() => null);
      if (!open || open.status === 'complete') throw new DealError('reserved', 409);
      if (open.status === 'open') {
        try {
          await stripe.checkout.sessions.expire(open.id);
        } catch {
          throw new DealError('reserved', 409);
        }
      }
      await Deal.updateOne({ _id: deal._id, status: 'awaiting_payment', stripe_session_id: open.id }, { $set: { buyer_id: null, reserved_until: null, stripe_session_id: null } });
    }
    const now = new Date();
    const d = await Deal.findOneAndUpdate(
      { _id: deal._id, seller_id: oid(userId), status: 'awaiting_payment', $or: [{ reserved_until: null }, { reserved_until: { $lt: now } }] },
      { $set: { status: 'cancelled', cancelled_at: now } },
    );
    if (!d) throw new DealError('reserved', 409);
    return;
  }

  const decision = decideAction(toRow(deal), userId, 'cancel');
  if (!decision.ok) throw new DealError(decision.code, decision.status);

  // إلغاء المشتري: نحجز الصف أول عشان ما يتسابق مع «تم الشحن» من البائع
  const buyerCancel = str(deal.buyer_id) === userId;
  if (buyerCancel) {
    const claimed = await Deal.findOneAndUpdate(
      { _id: deal._id, buyer_id: oid(userId), status: 'held' },
      { $set: { status: 'cancelled', cancelled_at: new Date() } },
    );
    if (!claimed) throw new DealError('bad_state', 409);
  }
  try {
    const pi = await getStripe().paymentIntents.cancel(deal.payment_intent_id!, { cancellation_reason: 'requested_by_customer' }, { idempotencyKey: `cancel-${dealId}` });
    if (!buyerCancel) {
      await Deal.updateOne({ _id: deal._id, status: { $in: ['held', 'shipped'] } }, { $set: { status: statusAfterCancel(pi.cancellation_reason), cancelled_at: new Date() } });
    }
  } catch (err) {
    console.error('[cancel] stripe', (err as Error).name);
    if (buyerCancel) {
      // نرجع الصفقة حسب حالة الدفع الحقيقية في Stripe، مو على العمياني
      const pi = await getStripe().paymentIntents.retrieve(deal.payment_intent_id!).catch(() => null);
      if (pi?.status === 'canceled') return; // الإلغاء صار فعلًا
      if (pi?.status === 'succeeded') {
        await Deal.updateOne({ _id: deal._id, status: 'cancelled' }, { $set: { status: 'released', released_at: new Date(), cancelled_at: null } });
      } else {
        await Deal.updateOne({ _id: deal._id, status: 'cancelled' }, { $set: { status: 'held', cancelled_at: null } });
      }
    }
    throw new DealError('stripe_conflict', 409);
  }
}

/** الحالة الحقيقية تجي من هنا بس: حدث موقّع من Stripe، مو فتح رابط النجاح */
export async function handleStripeEvent(event: Stripe.Event): Promise<{ status: number; body: Record<string, unknown> }> {
  if (event.livemode) return { status: 200, body: { ignored: 'live-mode event' } };
  const stripe = getStripe();
  await connectDB();

  /** نفك الحجز. إذا فشل نرجع 500 عشان Stripe يعيد المحاولة، وما تبقى فلوس المشتري معلقة */
  const voidHold = async (id: string) => {
    try {
      await stripe.paymentIntents.cancel(id, { cancellation_reason: 'abandoned' });
      return true;
    } catch (err) {
      if ((err as { code?: string }).code === 'payment_intent_unexpected_state') return true;
      console.error('[webhook] void failed', (err as Error).name);
      return false;
    }
  };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const dealId = session.metadata?.deal_id ?? '';
    // حساب Stripe التجريبي مشترك مع مشاريع ثانية: جلسة بدون صفقة مو لنا
    if (!OBJECT_ID_RE.test(dealId)) return { status: 200, body: { ignored: 'not a Daman checkout' } };
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!piId) return { status: 400, body: { error: 'missing payment' } };

    const pi = await stripe.paymentIntents.retrieve(piId);
    const deal = await Deal.findById(dealId).lean<DealDoc>();
    const buyerId = session.metadata?.buyer_id ?? '';
    const decision = decideHold(deal ? toRow(deal) : null, {
      livemode: pi.livemode,
      metadataDealId: dealId,
      metadataBuyerId: buyerId,
      paymentIntentId: pi.id,
      paymentIntentStatus: pi.status,
      amount: pi.amount,
      currency: pi.currency,
    });
    if (decision.action === 'ignore') return { status: 200, body: { ignored: decision.reason } };
    if (decision.action === 'duplicate') return { status: 200, body: { received: true, duplicate: true } };
    if (decision.action === 'void') {
      console.error('[webhook] voiding hold:', decision.reason);
      return (await voidHold(pi.id)) ? { status: 200, body: { received: true, voided: decision.reason } } : { status: 500, body: { error: 'void failed' } };
    }

    const held = OBJECT_ID_RE.test(buyerId)
      ? await Deal.findOneAndUpdate(
          { _id: oid(dealId), status: 'awaiting_payment', buyer_id: oid(buyerId) },
          { $set: { status: 'held', payment_intent_id: pi.id, paid_at: new Date(), reserved_until: null, charge_amount: pi.amount, charge_currency: pi.currency } },
        )
      : null;
    if (!held) {
      // تغيرت الصفقة بين القراءة والكتابة. إذا اللي غيرها نسخة ثانية من نفس الحدث، الحجز صحيح ونخليه
      const current = await Deal.findById(dealId, 'payment_intent_id').lean<{ payment_intent_id: string | null }>();
      if (current?.payment_intent_id === pi.id) return { status: 200, body: { received: true, duplicate: true } };
      return (await voidHold(pi.id)) ? { status: 200, body: { received: true, voided: 'deal changed' } } : { status: 500, body: { error: 'void failed' } };
    }
    return { status: 200, body: { received: true } };
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const dealId = session.metadata?.deal_id ?? '';
    if (OBJECT_ID_RE.test(dealId)) {
      await Deal.updateOne(
        { _id: oid(dealId), status: 'awaiting_payment', stripe_session_id: session.id },
        { $set: { buyer_id: null, reserved_until: null, stripe_session_id: null } },
      );
    }
    return { status: 200, body: { received: true } };
  }

  if (event.type === 'payment_intent.canceled' || event.type === 'payment_intent.succeeded') {
    // احتياط: لو انفك الحجز أو انسحب المبلغ وما تحدثت الصفقة (انقطاع أو انتهاء مدة الحجز)
    const pi = event.data.object as Stripe.PaymentIntent;
    const now = new Date();
    const patch = event.type === 'payment_intent.succeeded'
      ? { status: 'released', released_at: now }
      : { status: statusAfterCancel(pi.cancellation_reason), cancelled_at: now };
    await Deal.updateOne({ payment_intent_id: pi.id, status: { $in: ['held', 'shipped'] } }, { $set: patch });
    return { status: 200, body: { received: true } };
  }

  return { status: 200, body: { ignored: event.type } };
}
