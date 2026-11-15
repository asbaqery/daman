import { getSession } from '@/lib/auth';
import { DealPage } from '@/components/DealPage';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession().catch(() => ({ status: 'anonymous' as const }));
  const userId = session.status === 'authenticated' ? session.user.id : 'guest';
  return <DealPage key={`${id}:${userId}`} id={id} paid={sp.paid === '1'} loggedIn={session.status === 'authenticated'} />;
}
