'use client';

import { useMemo, useState } from 'react';
import { useDeleteTask, useTasks, useUpdateTask } from '@/hooks/use-tasks';
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '@/lib/constants';
import type { Task } from '@/lib/types';
import { TaskItem } from './task-item';
import { TaskFormDialog } from './task-form-dialog';
import { CloseIcon } from './close-icon';

type Filter = 'all' | TaskStatus;

export function TaskBoard() {
  const { data, isPending, isError, error, refetch, isFetching } = useTasks();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<{ open: boolean; task?: Task }>({ open: false });

  const tasks = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: tasks.length, todo: 0, in_progress: 0, done: 0 };
    tasks.forEach((t) => c[t.status]++);
    return c;
  }, [tasks]);

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  // Both mutations are optimistic and roll back on failure, so say what happened instead of reverting silently.
  let actionError: string | null = null;
  if (update.error) actionError = `Couldn't change the status: ${update.error.message}`;
  else if (del.error) actionError = `Couldn't delete the task: ${del.error.message}`;

  function renderTasks() {
    if (isPending) {
      return (
        <ul className="space-y-2" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </ul>
      );
    }
    if (data === undefined) return null; // the first load failed; the error above explains it

    if (visible.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {tasks.length === 0 ? 'No tasks yet. Create your first one.' : 'No tasks with this status.'}
        </div>
      );
    }

    return (
      <ul className="space-y-2">
        {visible.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onEdit={() => setDialog({ open: true, task })}
            onStatusChange={(status) => update.mutate({ id: task.id, status })}
            onDelete={() => del.mutate(task.id)}
            statusPending={update.isPending && update.variables?.id === task.id}
            deletePending={del.isPending && del.variables === task.id}
          />
        ))}
      </ul>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My tasks</h1>
        <button
          onClick={() => setDialog({ open: true })}
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New task
        </button>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-slate-200"
        aria-label="Filter by status"
      >
        {(['all', ...TASK_STATUSES] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]} <span className="opacity-70">({counts[f]})</span>
          </button>
        ))}
      </nav>

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{actionError}</span>
          <button
            onClick={() => {
              update.reset();
              del.reset();
            }}
            aria-label="Dismiss"
            className="-m-1 shrink-0 rounded-md p-1 hover:bg-red-100"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* A failed background refresh keeps the tasks already on screen; the error shows above them. */}
      {isError && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Couldn&apos;t load tasks: {error.message}{' '}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="font-medium underline disabled:no-underline disabled:opacity-60"
          >
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {renderTasks()}

      {dialog.open && <TaskFormDialog task={dialog.task} onClose={() => setDialog({ open: false })} />}
    </section>
  );
}
