import 'server-only';
import mongoose from 'mongoose';
import { DatabaseUnavailableError, MissingSecretError, logServerError } from './errors';

/**
 * اتصال Mongoose مشترك ومخزّن على globalThis:
 * - في التطوير: يمنع فتح اتصال جديد مع كل إعادة تحميل للملفات (HMR).
 * - على Vercel/Serverless: يعيد استخدام الاتصال بين الطلبات في نفس الحاوية.
 * نخزّن الاتصال الجاهز والـpromise الجاري معًا حتى لا تفتح الطلبات المتزامنة اتصالات متعددة.
 */
type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as typeof globalThis & { __damanMongoose?: MongooseCache };
const cache: MongooseCache = (globalForMongoose.__damanMongoose ??= { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new MissingSecretError('MONGODB_URI');
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) throw new MissingSecretError('MONGODB_URI', 'must start with mongodb+srv:// or mongodb://');

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (err) {
    // نسمح بمحاولة جديدة في الطلب التالي بدل الاحتفاظ بـpromise فاشل
    cache.promise = null;
    cache.conn = null;
    logServerError('db', err);
    throw new DatabaseUnavailableError();
  }
}
