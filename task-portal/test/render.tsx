import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';

// Renders to HTML with the providers client components expect. Pass a client pre-filled with
// setQueryData to render a specific data state. Components that call useRouter also need a
// vi.mock of next/navigation (the real hook needs a mounted app router).
export function renderToHtml(ui: React.ReactNode, client = new QueryClient()): string {
  return renderToStaticMarkup(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Returns the opening tag of the form control with this name, so its attributes can be checked in any order. */
export function fieldTag(html: string, name: string, tag = 'input'): string {
  const match = html.match(new RegExp(`<${tag}[^>]*name="${name}"[^>]*>`))?.[0];
  if (!match) throw new Error(`no <${tag} name="${name}"> in the rendered HTML`);
  return match;
}
