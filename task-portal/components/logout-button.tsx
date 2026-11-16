'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function LogoutButton() {
  const router = useRouter();
  const qc = useQueryClient();

  const logout = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear(); // otherwise the next user on this browser could briefly see cached tasks
      router.replace('/login');
      router.refresh();
    },
  });

  return (
    <div className="flex items-center gap-2">
      {logout.isError && (
        <span role="alert" className="text-xs text-red-600">
          Couldn&apos;t log out
        </span>
      )}
      <button
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
      >
        {logout.isPending ? 'Logging out…' : 'Log out'}
      </button>
    </div>
  );
}
