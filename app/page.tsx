import { getSession } from '@/lib/auth';
import { Home } from '@/components/Home';
import { AuthForm } from '@/components/AuthForm';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession().catch(() => ({ status: 'anonymous' as const }));
  if (session.status === 'authenticated') return <Home key={session.user.id} userId={session.user.id} />;
  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold text-slate-900">لا تحوّل لحساب ما تعرفه. ادفع بضمان.</h1>
        <p className="mt-2 text-slate-600">المبلغ ينحجز على بطاقتك وما ينتقل للبائع إلا لما تستلم طلبك. والبائع يشحن وهو متطمن إن الفلوس موجودة.</p>
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          {['البائع يسوي رابط', 'المشتري يدفع والمبلغ ينحجز', 'البائع يشحن', 'المشتري يستلم والمبلغ ينتقل'].map((s, i) => (
            <li key={s} className="rounded-xl border border-slate-200 px-3 py-2"><span className="font-bold text-indigo-600">{i + 1}.</span> {s}</li>
          ))}
        </ol>
      </section>
      <AuthForm />
    </div>
  );
}
