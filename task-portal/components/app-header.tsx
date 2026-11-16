import type { SessionUser } from '@/lib/auth/session';
import { LogoutButton } from './logout-button';

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="font-semibold">Task Portal</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
