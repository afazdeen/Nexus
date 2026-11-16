'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function LogoutButton() {
  const router = useRouter();
  const qc = useQueryClient();

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    qc.clear(); // otherwise the next user on this browser could briefly see cached tasks
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      Log out
    </button>
  );
}
