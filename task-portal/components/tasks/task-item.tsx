'use client';

import { PRIORITY_LABELS, PRIORITY_STYLES, type TaskStatus } from '@/lib/constants';
import type { Task } from '@/lib/types';
import { StatusSelect } from './status-select';

type Props = {
  task: Task;
  onEdit: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: () => void;
  statusPending?: boolean;
  deletePending?: boolean;
};

// Presentational: the board owns the mutations, so their errors survive this row unmounting
// (an optimistic delete, or a status change that moves the task out of the current filter).
export function TaskItem({ task, onEdit, onStatusChange, onDelete, statusPending, deletePending }: Props) {
  // Compare against the user's local date ('en-CA' formats as YYYY-MM-DD), not the UTC date from toISOString().
  const today = new Date().toLocaleDateString('en-CA');
  const overdue = task.dueDate && task.status !== 'done' && task.dueDate < today;

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className={`font-medium wrap-break-word ${task.status === 'done' ? 'text-slate-400 line-through' : ''}`}>
          {task.title}
        </p>
        {task.description && <p className="line-clamp-2 text-sm wrap-break-word text-slate-600">{task.description}</p>}
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className={PRIORITY_STYLES[task.priority]}>{PRIORITY_LABELS[task.priority]} priority</span>
          {task.dueDate && (
            <span className={overdue ? 'text-red-600' : 'text-slate-500'}>
              Due {task.dueDate}
              {overdue && ' (overdue)'}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusSelect status={task.status} onChange={onStatusChange} disabled={statusPending} />
        <button onClick={onEdit} className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
          Edit
        </button>
        <button
          onClick={() => confirm(`Delete "${task.title}"?`) && onDelete()}
          disabled={deletePending}
          className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {deletePending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </li>
  );
}
