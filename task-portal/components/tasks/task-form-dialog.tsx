'use client';

import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { createTaskSchema } from '@/lib/validators';
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';
import { ApiError } from '@/lib/api-client';
import type { Task } from '@/lib/types';
import { CloseIcon } from '@/components/close-icon';

export function TaskFormDialog({ task, onClose }: { task?: Task; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const create = useCreateTask();
  const update = useUpdateTask();
  const mutation = task ? update : create;
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  useEffect(() => {
    ref.current?.showModal();
    // showModal() focuses the first control (the ✕ button); start typing in the title instead.
    titleRef.current?.focus();
  }, []);

  // Always close through the native dialog: it fires onClose (which unmounts us) and the browser
  // returns focus to the button that opened the dialog. Unmounting an open dialog would drop focus.
  const close = () => ref.current?.close();

  function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    // An empty optional input means "none", which the API expects as null.
    const optional = (name: string) => {
      const v = f.get(name);
      return typeof v === 'string' && v !== '' ? v : null;
    };
    const values = {
      title: f.get('title'),
      description: optional('description'),
      status: f.get('status'),
      priority: f.get('priority'),
      dueDate: optional('dueDate'),
    };
    const parsed = createTaskSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setErrors({});

    const options = {
      onSuccess: close,
      onError: (err: Error) => {
        if (err instanceof ApiError && err.issues) setErrors(err.issues);
      },
    };
    if (task) update.mutate({ id: task.id, ...parsed.data }, options);
    else create.mutate(parsed.data, options);
  }

  const error = mutation.error;
  const formError = error && !(error instanceof ApiError && error.issues) ? error.message : null;
  const input =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 aria-[invalid=true]:border-red-500';
  // Ties a field to its error message so screen readers announce it.
  const errorProps = (name: string) => ({
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `task-${name}-error` : undefined,
  });
  const title = task ? 'Edit task' : 'New task';
  const submitLabel = task ? 'Save changes' : 'Create task';

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="task-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 backdrop:bg-black/40"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="task-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <CloseIcon />
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Title</span>
          <input ref={titleRef} name="title" defaultValue={task?.title} className={input} {...errorProps('title')} />
          {errors.title && (
            <span id="task-title-error" className="text-xs text-red-600">
              {errors.title[0]}
            </span>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={task?.description ?? ''}
            className={input}
            {...errorProps('description')}
          />
          {errors.description && (
            <span id="task-description-error" className="text-xs text-red-600">
              {errors.description[0]}
            </span>
          )}
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
          <input
            type="date"
            name="dueDate"
            defaultValue={task?.dueDate ?? ''}
            className={input}
            {...errorProps('dueDate')}
          />
          {errors.dueDate && (
            <span id="task-dueDate-error" className="text-xs text-red-600">
              {errors.dueDate[0]}
            </span>
          )}
        </label>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={close} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {mutation.isPending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
