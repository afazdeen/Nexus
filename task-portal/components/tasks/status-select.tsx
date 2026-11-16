'use client';

import { STATUS_LABELS, STATUS_STYLES, TASK_STATUSES, type TaskStatus } from '@/lib/constants';

type Props = {
  status: TaskStatus;
  onChange: (status: TaskStatus) => void;
  disabled?: boolean;
};

export function StatusSelect({ status, onChange, disabled }: Props) {
  return (
    <select
      aria-label="Change status"
      value={status}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:opacity-60 ${STATUS_STYLES[status]}`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
