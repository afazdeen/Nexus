'use client';

import { STATUS_LABELS, STATUS_STYLES, TASK_STATUSES, type TaskStatus } from '@/lib/constants';
import { useUpdateTask } from '@/hooks/use-tasks';

export function StatusSelect({ id, status }: { id: string; status: TaskStatus }) {
  const update = useUpdateTask();
  return (
    <select
      aria-label="Change status"
      value={status}
      onChange={(e) => update.mutate({ id, status: e.target.value as TaskStatus })}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
