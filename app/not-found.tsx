import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-xl font-bold text-slate-900">الصفحة مو موجودة</h1>
      <Link href="/" className="btn-ghost mt-4">الرئيسية</Link>
    </div>
  );
}
