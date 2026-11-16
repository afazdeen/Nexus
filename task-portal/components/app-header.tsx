import type { SessionUser } from '@/lib/auth/session';

// The logout button is added in Phase 7, once the TanStack Query provider exists (Phase 6).
export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="font-semibold">Task Portal</span>
        <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
      </div>
    </header>
  );
}
