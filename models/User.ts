import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    },
    // select:false — لا يُقرأ إلا عند طلبه صراحة (تسجيل الدخول فقط)
    passwordHash: { type: String, required: true, select: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// إعادة استخدام الموديل إن كان معرّفًا (يمنع OverwriteModelError أثناء التطوير)
export const User: Model<UserDoc> = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>('User', userSchema);
