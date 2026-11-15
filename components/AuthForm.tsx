'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/** تسجيل دخول / حساب جديد. الجلسة في كوكي httpOnly من الخادم. compact: داخل صفحة الصفقة */
export function AuthForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'signup' && password.length < 8) return setError('كلمة المرور لازم تكون 8 أحرف أو أكثر.');
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
      if (!res.ok) {
        const first = data.fields ? Object.values(data.fields)[0] : undefined;
        setError(res.status === 401 ? 'الإيميل أو كلمة المرور غلط.' : res.status === 409 ? 'هذا الإيميل مسجل من قبل. سجّل دخول.' : first ?? data.error ?? 'صار خطأ. جرب مرة ثانية.');
        setBusy(false);
        return;
      }
      // الخادم حط كوكي الجلسة: نحدّث الصفحة عشان تعرف إنك مسجل
      router.refresh();
    } catch {
      setError('ما قدرنا نوصل للسيرفر. شيك على الإنترنت.');
      setBusy(false);
    }
  };

  return (
    <div className={compact ? '' : 'mx-auto max-w-md'}>
      <form onSubmit={submit} className={compact ? 'space-y-4' : 'card space-y-4'} noValidate aria-label="تسجيل الدخول">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold" role="tablist">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(null); }}
              className={`rounded-lg py-2 ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {m === 'login' ? 'تسجيل دخول' : 'حساب جديد'}
            </button>
          ))}
        </div>
        {mode === 'signup' && (
          <label className="block">
            <span className="label">الاسم</span>
            <input className="field" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className="label">الإيميل</span>
          <input className="field" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">كلمة المرور</span>
          <input
            className="field"
            type="password"
            dir="ltr"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && <span className="mt-1 block text-xs text-slate-500">8 أحرف أو أكثر</span>}
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !email || !password || (mode === 'signup' && !name)}>
          {busy ? 'لحظة…' : mode === 'login' ? 'دخول' : 'سوّ حسابي'}
        </button>
      </form>
    </div>
  );
}
