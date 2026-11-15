import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import './globals.css';
import { getSession } from '@/lib/auth';
import { SignOutButton } from '@/components/SignOutButton';

export const metadata: Metadata = {
  title: 'ضمان · ادفع بأمان',
  description: 'ضمان: ادفع لحسابات الإنستغرام بأمان. المبلغ ينحجز وما يوصل للبائع إلا لما تستلم.',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f172a' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // الهيدر يعرف إذا المستخدم مسجل. لو القاعدة ما ردت نكمل كزائر بدل ما تطيح الصفحة كلها
  const session = await getSession().catch(() => ({ status: 'anonymous' as const }));
  const user = session.status === 'authenticated' ? session.user : null;
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
          <header className="mb-6 flex items-center justify-between gap-3">
            <Link href="/" className="text-start">
              <span className="block text-2xl font-bold text-slate-900">ضمان 🛡️</span>
              <span className="block text-xs text-slate-500">ادفع بأمان لحسابات الإنستغرام</span>
            </Link>
            {user && (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-slate-500 sm:inline" dir="ltr">{user.email}</span>
                <SignOutButton />
              </div>
            )}
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
