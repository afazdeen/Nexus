'use client';

import { PRIORITY_LABELS, PRIORITY_STYLES } from '@/lib/constants';
import { useDeleteTask } from '@/hooks/use-tasks';
import type { Task } from '@/lib/types';
import { StatusSelect } from './status-select';

export function TaskItem({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const del = useDeleteTask();
  // Compare against the user's local date ('en-CA' formats as YYYY-MM-DD), not the UTC date from toISOString().
  const today = new Date().toLocaleDateString('en-CA');
  const overdue = task.dueDate && task.status !== 'done' && task.dueDate < today;

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className={`font-medium ${task.status === 'done' ? 'text-slate-400 line-through' : ''}`}>{task.title}</p>
        {task.description && <p className="line-clamp-2 text-sm text-slate-600">{task.description}</p>}
        <p className="flex gap-3 text-xs">
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
        <StatusSelect id={task.id} status={task.status} />
        <button onClick={onEdit} className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
          Edit
        </button>
        <button
          onClick={() => confirm(`Delete "${task.title}"?`) && del.mutate(task.id)}
          className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
