import { describe, expect, it } from 'vitest';
import { renderToHtml } from '@/test/render';
import ErrorPage from './error';

describe('error boundary page', () => {
  const html = renderToHtml(<ErrorPage error={new Error('db down')} retry={() => {}} />);

  it('announces the failure and offers a retry', () => {
    expect(html).toContain('role="alert"');
    expect(html).toContain('Something went wrong');
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
  });

  it('does not leak the underlying error message', () => {
    expect(html).not.toContain('db down');
  });
});
