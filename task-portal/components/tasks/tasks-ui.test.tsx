import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { fieldTag, renderToHtml } from '@/test/render';
import { tasksKey } from '@/hooks/use-tasks';
import type { Task } from '@/lib/types';
import { TaskBoard } from './task-board';
import { TaskItem } from './task-item';
import { StatusSelect } from './status-select';
import { TaskFormDialog } from './task-form-dialog';
import TasksPage from '@/app/(portal)/tasks/page';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'A task',
    description: null,
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function clientWith(tasks: Task[]) {
  const client = new QueryClient();
  client.setQueryData(tasksKey, tasks);
  return client;
}

/** The selected <option> value inside a rendered <select name="…"> (or the only select if no name). */
function selectedOption(html: string, name?: string): string | undefined {
  const select = name ? html.match(new RegExp(`<select[^>]*name="${name}"[^>]*>.*?</select>`))?.[0] : html;
  return select?.match(/<option value="([^"]+)" selected=""/)?.[1];
}

const noop = () => {};
const handlers = { onEdit: noop, onStatusChange: noop, onDelete: noop };

afterEach(() => {
  vi.useRealTimers();
});

describe('TaskBoard', () => {
  it('shows a loading skeleton before the tasks arrive', () => {
    const html = renderToHtml(<TaskBoard />);

    expect(html).toContain('aria-label="Loading tasks"');
    expect(html).toContain('animate-pulse');
  });

  it('always shows the heading and the New task button', () => {
    const html = renderToHtml(<TaskBoard />);

    expect(html).toContain('My tasks');
    expect(html).toMatch(/<button[^>]*>New task<\/button>/);
  });

  it('shows the empty state for a user with no tasks', () => {
    const html = renderToHtml(<TaskBoard />, clientWith([]));

    expect(html).toContain('No tasks yet. Create your first one.');
  });

  it('lists the tasks in the order the API returned them', () => {
    const html = renderToHtml(
      <TaskBoard />,
      clientWith([makeTask({ title: 'First' }), makeTask({ title: 'Second' })]),
    );

    expect(html.indexOf('First')).toBeGreaterThan(-1);
    expect(html.indexOf('First')).toBeLessThan(html.indexOf('Second'));
  });

  it('shows a count per status on the filter tabs, with All selected', () => {
    const html = renderToHtml(
      <TaskBoard />,
      clientWith([
        makeTask({ status: 'todo' }),
        makeTask({ status: 'in_progress' }),
        makeTask({ status: 'done' }),
        makeTask({ status: 'done' }),
      ]),
    );

    expect(html).toMatch(/aria-pressed="true"[^>]*>All <span[^>]*>\(4\)<\/span>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>To do <span[^>]*>\(1\)<\/span>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>In progress <span[^>]*>\(1\)<\/span>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Done <span[^>]*>\(2\)<\/span>/);
  });

  it('shows the error with a Retry button when loading fails', async () => {
    const client = new QueryClient();
    // A fresh mount would retry a failed query (showing the skeleton); this renders the "failed while on screen" state.
    client.setQueryDefaults(tasksKey, { retryOnMount: false });
    await client.prefetchQuery({ queryKey: tasksKey, queryFn: () => Promise.reject(new Error('Server down')) });

    const html = renderToHtml(<TaskBoard />, client);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Couldn&#x27;t load tasks: Server down');
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  it('keeps the tasks on screen when a background refresh fails, with the error above them', async () => {
    const client = clientWith([makeTask({ title: 'Still here' })]);
    client.setQueryDefaults(tasksKey, { retryOnMount: false });
    await client.prefetchQuery({ queryKey: tasksKey, queryFn: () => Promise.reject(new Error('Server down')) });

    const html = renderToHtml(<TaskBoard />, client);

    expect(html).toContain('Couldn&#x27;t load tasks: Server down');
    expect(html).toContain('Still here');
    expect(html.indexOf('Server down')).toBeLessThan(html.indexOf('Still here'));
  });

  it('does not open the dialog until asked', () => {
    expect(renderToHtml(<TaskBoard />, clientWith([]))).not.toContain('<dialog');
  });

  it('is what the /tasks page renders', () => {
    expect(renderToHtml(<TasksPage />, clientWith([]))).toContain('My tasks');
  });
});

describe('TaskItem', () => {
  it('shows the title, description, priority and due date', () => {
    const task = makeTask({ title: 'Write report', description: 'Q3 numbers', priority: 'high', dueDate: '2099-01-01' });

    const html = renderToHtml(<TaskItem task={task} {...handlers} />);

    expect(html).toContain('Write report');
    expect(html).toContain('Q3 numbers');
    expect(html).toContain('High priority');
    expect(html).toContain('Due 2099-01-01');
  });

  it('leaves out the description and due date when they are empty', () => {
    const html = renderToHtml(<TaskItem task={makeTask()} {...handlers} />);

    expect(html).not.toContain('line-clamp-2');
    expect(html).not.toContain('Due ');
  });

  it('strikes through finished tasks', () => {
    expect(renderToHtml(<TaskItem task={makeTask({ status: 'done' })} {...handlers} />)).toContain('line-through');
    expect(renderToHtml(<TaskItem task={makeTask({ status: 'todo' })} {...handlers} />)).not.toContain('line-through');
  });

  it('has Edit and Delete buttons and a status dropdown', () => {
    const html = renderToHtml(<TaskItem task={makeTask({ status: 'in_progress' })} {...handlers} />);

    expect(html).toMatch(/<button[^>]*>Edit<\/button>/);
    expect(html).toMatch(/<button[^>]*>Delete<\/button>/);
    expect(selectedOption(html)).toBe('in_progress');
  });

  it('enables the status dropdown and Delete button when nothing is pending', () => {
    const html = renderToHtml(<TaskItem task={makeTask()} {...handlers} />);

    expect(html).not.toContain('disabled=""');
  });

  it('disables the status dropdown while its change is saving', () => {
    const html = renderToHtml(<TaskItem task={makeTask()} {...handlers} statusPending />);

    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>Delete<\/button>/);
  });

  it('disables Delete and says so while the delete is in flight', () => {
    const html = renderToHtml(<TaskItem task={makeTask()} {...handlers} deletePending />);

    expect(html).toMatch(/<button disabled=""[^>]*>Deleting…<\/button>/);
  });

  it('lets long unbroken titles and descriptions wrap (no sideways scrolling on phones)', () => {
    const html = renderToHtml(<TaskItem task={makeTask({ description: 'x'.repeat(300) })} {...handlers} />);

    expect(html.match(/wrap-break-word/g)).toHaveLength(2);
  });

  describe('overdue marker (uses the local date)', () => {
    // Local noon on 15 June 2026, so the result does not depend on the machine's timezone.
    const setToday = () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 5, 15, 12));
    };
    const render = (overrides: Partial<Task>) => renderToHtml(<TaskItem task={makeTask(overrides)} {...handlers} />);

    it('marks an unfinished task due yesterday as overdue', () => {
      setToday();
      const html = render({ dueDate: '2026-06-14' });

      expect(html).toContain('(overdue)');
      expect(html).toContain('text-red-600');
    });

    it('does not mark a task due today', () => {
      setToday();

      expect(render({ dueDate: '2026-06-15' })).not.toContain('(overdue)');
    });

    it('does not mark a finished task, even if its due date has passed', () => {
      setToday();

      expect(render({ dueDate: '2026-06-14', status: 'done' })).not.toContain('(overdue)');
    });

    it('uses the local date, not UTC, just after local midnight', () => {
      // 00:30 local on 16 June. In timezones east of UTC, toISOString() would still say 15 June.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 5, 16, 0, 30));

      expect(render({ dueDate: '2026-06-15' })).toContain('(overdue)');
    });
  });
});

describe('StatusSelect', () => {
  it('selects the current status and offers all three', () => {
    const html = renderToHtml(<StatusSelect onChange={noop} status="done" />);

    expect(html).toContain('aria-label="Change status"');
    expect(selectedOption(html)).toBe('done');
    expect(html.match(/<option /g)).toHaveLength(3);
  });

  it('colours the badge by status', () => {
    expect(renderToHtml(<StatusSelect onChange={noop} status="done" />)).toContain('bg-emerald-50');
    expect(renderToHtml(<StatusSelect onChange={noop} status="in_progress" />)).toContain('bg-amber-50');
  });
});

describe('TaskFormDialog', () => {
  it('starts empty with the default status and priority when creating', () => {
    const html = renderToHtml(<TaskFormDialog onClose={noop} />);

    expect(html).toContain('New task');
    expect(fieldTag(html, 'title')).not.toContain('value=');
    expect(fieldTag(html, 'dueDate')).toContain('value=""');
    expect(selectedOption(html, 'status')).toBe('todo');
    expect(selectedOption(html, 'priority')).toBe('medium');
    expect(html).toMatch(/<button type="submit"[^>]*>Create task<\/button>/);
  });

  it("is filled with the task's current values when editing", () => {
    const task = makeTask({
      title: 'Write report',
      description: 'Q3 numbers',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-12-31',
    });

    const html = renderToHtml(<TaskFormDialog task={task} onClose={noop} />);

    expect(html).toContain('Edit task');
    expect(fieldTag(html, 'title')).toContain('value="Write report"');
    expect(html).toMatch(/<textarea name="description"[^>]*>Q3 numbers<\/textarea>/);
    expect(fieldTag(html, 'dueDate')).toContain('value="2026-12-31"');
    expect(fieldTag(html, 'dueDate')).toContain('type="date"');
    expect(selectedOption(html, 'status')).toBe('in_progress');
    expect(selectedOption(html, 'priority')).toBe('high');
    expect(html).toMatch(/<button type="submit"[^>]*>Save changes<\/button>/);
  });

  it('labels every field and has a Cancel button that does not submit', () => {
    const html = renderToHtml(<TaskFormDialog onClose={noop} />);

    for (const label of ['Title', 'Description', 'Status', 'Priority', 'Due date']) {
      expect(html).toContain(`<span class="text-sm font-medium">${label}</span>`);
    }
    expect(html).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
  });

  it('uses its own validation instead of the browser popups', () => {
    expect(renderToHtml(<TaskFormDialog onClose={noop} />)).toMatch(/<form[^>]*noValidate/);
  });

  it('has a labelled ✕ close button at the top, next to the heading', () => {
    const html = renderToHtml(<TaskFormDialog onClose={noop} />);

    const close = html.match(/<button type="button"[^>]*aria-label="Close"[^>]*>(.*?)<\/button>/);
    expect(close).not.toBeNull();
    expect(close?.[1]).toMatch(/^<svg aria-hidden="true"/); // the icon itself is hidden from screen readers
    expect(html.indexOf('aria-label="Close"')).toBeLessThan(html.indexOf('name="title"'));
  });

  it('is named by its heading for screen readers', () => {
    const html = renderToHtml(<TaskFormDialog onClose={noop} />);

    expect(html).toContain('aria-labelledby="task-dialog-title"');
    expect(html).toContain('<h2 id="task-dialog-title" class="text-lg font-semibold">New task</h2>');
  });

  it('shows a visible focus ring on its inputs', () => {
    expect(fieldTag(renderToHtml(<TaskFormDialog onClose={noop} />), 'title')).toContain('focus:ring-1');
  });
});
