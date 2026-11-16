import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

// Base fields have NO defaults on purpose: in Zod v4 defaults still apply inside .optional(),
// so deriving the PATCH schema from one with defaults would reset omitted fields.
const taskFields = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  // A blank description is stored as null, never '', so "no description" has one representation.
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null)
    .nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.iso.date('Use YYYY-MM-DD').nullable(),
});

export const createTaskSchema = taskFields.extend({
  description: taskFields.shape.description.optional(),
  status: taskFields.shape.status.default('todo'),
  priority: taskFields.shape.priority.default('medium'),
  dueDate: taskFields.shape.dueDate.optional(),
});

export const updateTaskSchema = taskFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const taskListQuerySchema = z.object({ status: z.enum(TASK_STATUSES).optional() });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
