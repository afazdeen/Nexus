import type { TaskPriority, TaskStatus } from '@/lib/constants';

// Client-side shape of a task: dates arrive as ISO strings over JSON, unlike TaskRow.
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};
