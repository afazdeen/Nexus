import type { TaskRow } from '@/lib/db/schema';

// Client-side shape of a task: dates arrive as ISO strings over JSON, unlike TaskRow.
export type Task = Omit<TaskRow, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
