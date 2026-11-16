import { describe, expect, it } from 'vitest';
import { renderToHtml } from '@/test/render';
import { ConfirmDialog } from '@/components/confirm-dialog';

const noop = () => {};

describe('ConfirmDialog', () => {
  const html = renderToHtml(
    <ConfirmDialog
      title="Delete task?"
      message={<>&ldquo;Write report&rdquo; will be permanently deleted.</>}
      confirmLabel="Delete"
      onConfirm={noop}
      onClose={noop}
    />,
  );

  it('is announced as an alert dialog, named by its title and described by its message', () => {
    const dialog = html.match(/<dialog[^>]*>/)?.[0] ?? '';
    const labelId = dialog.match(/aria-labelledby="([^"]+)"/)?.[1];
    const messageId = dialog.match(/aria-describedby="([^"]+)"/)?.[1];

    expect(dialog).toContain('role="alertdialog"');
    expect(html).toContain(`<h2 id="${labelId}" class="text-lg font-semibold">Delete task?</h2>`);
    expect(html).toMatch(new RegExp(`id="${messageId}"[^>]*>“Write report” will be permanently deleted.`));
  });

  it('offers Cancel and a red confirm button, neither of which submits a form', () => {
    expect(html).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
    expect(html).toMatch(/<button type="button" class="[^"]*bg-red-600[^"]*">Delete<\/button>/);
  });

  it('puts Cancel before the destructive button', () => {
    expect(html.indexOf('>Cancel<')).toBeLessThan(html.indexOf('>Delete<'));
  });

  it('has a labelled ✕ close button', () => {
    expect(html).toMatch(/<button type="button"[^>]*aria-label="Close"[^>]*><svg aria-hidden="true"/);
  });
});
