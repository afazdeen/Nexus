'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Task } from '@/lib/types';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validators';

export const tasksKey = ['tasks'] as const;

export function useTasks() {
  return useQuery({
    queryKey: tasksKey,
    queryFn: () => api<{ tasks: Task[] }>('/api/tasks').then((r) => r.tasks),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api<{ task: Task }>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.task),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
}

/** Used for both editing and status changes. Updates the cache optimistically and rolls back on error. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTaskInput & { id: string }) =>
      api<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.task),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(tasksKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(tasksKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
}
