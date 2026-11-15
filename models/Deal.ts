import mongoose, { Schema, Types, type Model } from 'mongoose';
import { MAX_PRICE_FILS, MIN_PRICE_FILS } from '../lib/logic';

export const DEAL_STATUSES = ['awaiting_payment', 'held', 'shipped', 'released', 'cancelled', 'expired'] as const;

export interface DealDoc {
  _id: Types.ObjectId;
  seller_id: Types.ObjectId;
  buyer_id: Types.ObjectId | null;
  shop_name: string;
  title: string;
  description: string | null;
  price_fils: number;
  status: (typeof DEAL_STATUSES)[number];
  reserved_until: Date | null;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  charge_amount: number | null;
  charge_currency: string | null;
  created_at: Date;
  paid_at: Date | null;
  shipped_at: Date | null;
  released_at: Date | null;
  cancelled_at: Date | null;
}

const dealSchema = new Schema<DealDoc>(
  {
    seller_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyer_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    shop_name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, default: null, maxlength: 500 },
    // بالفلس: من 1 إلى 1000 دينار
    price_fils: { type: Number, required: true, min: MIN_PRICE_FILS, max: MAX_PRICE_FILS, validate: Number.isInteger },
    status: { type: String, enum: DEAL_STATUSES, default: 'awaiting_payment', required: true },
    reserved_until: { type: Date, default: null },
    stripe_session_id: { type: String, default: null },
    payment_intent_id: { type: String, default: null },
    charge_amount: { type: Number, default: null },
    charge_currency: { type: String, default: null },
    paid_at: { type: Date, default: null },
    shipped_at: { type: Date, default: null },
    released_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);

// معرّفات Stripe فريدة إذا موجودة (null مسموح يتكرر)
dealSchema.index({ stripe_session_id: 1 }, { unique: true, partialFilterExpression: { stripe_session_id: { $type: 'string' } } });
dealSchema.index({ payment_intent_id: 1 }, { unique: true, partialFilterExpression: { payment_intent_id: { $type: 'string' } } });

export const Deal: Model<DealDoc> = (mongoose.models.Deal as Model<DealDoc>) || mongoose.model<DealDoc>('Deal', dealSchema);
