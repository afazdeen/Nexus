import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';

// Renders to HTML with the providers client components expect.
// Pair with a vi.mock of `useRouter` from next/navigation (the real one needs a mounted app router).
export function renderToHtml(ui: React.ReactNode): string {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}
