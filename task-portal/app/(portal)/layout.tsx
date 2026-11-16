import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AppHeader } from '@/components/app-header';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader user={user} />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
