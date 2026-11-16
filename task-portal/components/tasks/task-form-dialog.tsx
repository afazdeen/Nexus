'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { createTaskSchema } from '@/lib/validators';
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';
import { ApiError } from '@/lib/api-client';
import type { Task } from '@/lib/types';

export function TaskFormDialog({ task, onClose }: { task?: Task; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = task ? update : create;
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = {
      title: f.get('title'),
      description: (f.get('description') as string) || null, // empty input → null
      status: f.get('status'),
      priority: f.get('priority'),
      dueDate: (f.get('dueDate') as string) || null,
    };
    const parsed = createTaskSchema.safeParse(values);
    if (!parsed.success) return setErrors(z.flattenError(parsed.error).fieldErrors);

    const options = {
      onSuccess: onClose,
      onError: (err: Error) => err instanceof ApiError && err.issues && setErrors(err.issues),
    };
    if (task) update.mutate({ id: task.id, ...parsed.data }, options);
    else create.mutate(parsed.data, options);
  }

  const error = mutation.error;
  const formError = error && !(error instanceof ApiError && error.issues) ? error.message : null;
  const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-full max-w-md rounded-xl p-0 backdrop:bg-black/40">
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{task ? 'Edit task' : 'New task'}</h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input name="title" defaultValue={task?.title} autoFocus className={input} />
          {errors.title && <span className="text-xs text-red-600">{errors.title[0]}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <textarea name="description" rows={3} defaultValue={task?.description ?? ''} className={input} />
          {errors.description && <span className="text-xs text-red-600">{errors.description[0]}</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Status</span>
            <select name="status" defaultValue={task?.status ?? 'todo'} className={input}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Priority</span>
            <select name="priority" defaultValue={task?.priority ?? 'medium'} className={input}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Due date</span>
          <input type="date" name="dueDate" defaultValue={task?.dueDate ?? ''} className={input} />
          {errors.dueDate && <span className="text-xs text-red-600">{errors.dueDate[0]}</span>}
        </label>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
