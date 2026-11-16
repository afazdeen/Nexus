'use client';

import { STATUS_DOT_STYLES, STATUS_LABELS, STATUS_STYLES, TASK_STATUSES, type TaskStatus } from '@/lib/constants';

type Props = {
  status: TaskStatus;
  onChange: (status: TaskStatus) => void;
  disabled?: boolean;
};

// A native <select> styled as a status pill: it keeps the platform's accessible, keyboard-friendly
// picker, with our own dot and chevron in place of the browser's arrow.
export function StatusSelect({ status, onChange, disabled }: Props) {
  return (
    <div className="relative inline-flex shrink-0">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full ${STATUS_DOT_STYLES[status]} ${disabled ? 'animate-pulse' : ''}`}
      />
      <select
        aria-label="Change status"
        value={status}
        disabled={disabled}
        onChange={(e) => {
          const next = TASK_STATUSES.find((s) => s === e.target.value);
          if (next) onChange(next);
        }}
        className={`cursor-pointer appearance-none rounded-full py-1 pr-7 pl-6 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-wait disabled:opacity-70 ${STATUS_STYLES[status]}`}
      >
        {TASK_STATUSES.map((s) => (
          // Without this, Windows tints the open list with the pill's background colour.
          <option key={s} value={s} className="bg-white text-slate-900">
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-slate-500"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  );
}
