import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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

// While other optimistic task mutations are in flight, a refetch would return server data without
// their changes and briefly undo them on screen, so only the last one to settle refetches.
function refetchWhenLastSettles(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: tasksKey }) === 1) return qc.invalidateQueries({ queryKey: tasksKey });
}

// Rollbacks restore only the task that failed, so they don't wipe out concurrent changes to other tasks.
// onError is set on the hook (not on mutate()) so it still fires after the calling row has unmounted.

/** Used for both editing and status changes. Updates the cache optimistically and rolls back on error. */
export function useUpdateTask(onError?: (err: Error) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: tasksKey,
    mutationFn: ({ id, ...patch }: UpdateTaskInput & { id: string }) =>
      api<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.task),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey)?.find((t) => t.id === id);
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      const previous = ctx?.previous;
      if (previous) qc.setQueryData<Task[]>(tasksKey, (old) => old?.map((t) => (t.id === previous.id ? previous : t)));
      onError?.(err);
    },
    onSettled: () => refetchWhenLastSettles(qc),
  });
}

export function useDeleteTask(onError?: (err: Error) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: tasksKey,
    mutationFn: (id: string) => api<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey)?.find((t) => t.id === id);
      qc.setQueryData<Task[]>(tasksKey, (old) => old?.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (err, _id, ctx) => {
      const previous = ctx?.previous;
      // Put it back in the API's order (newest first); ISO timestamps sort correctly as strings.
      if (previous) {
        qc.setQueryData<Task[]>(tasksKey, (old) =>
          old && [...old, previous].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      }
      onError?.(err);
    },
    onSettled: () => refetchWhenLastSettles(qc),
  });
}
