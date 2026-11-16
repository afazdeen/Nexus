import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GlobalError from './global-error';

describe('global error page', () => {
  const html = renderToStaticMarkup(<GlobalError error={new Error('db down')} retry={() => {}} />);

  it('renders a whole document, since it replaces the root layout', () => {
    expect(html).toMatch(/^<html lang="en">.*<body[^>]*>.*<\/body><\/html>$/);
  });

  it('announces the failure and offers a retry', () => {
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
  });

  it('does not leak the underlying error message', () => {
    expect(html).not.toContain('db down');
  });
});
