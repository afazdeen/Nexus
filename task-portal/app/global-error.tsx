'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import './globals.css';

// Last resort for errors in the root layout itself (e.g. Providers), which app/error.tsx can't catch
// because it renders inside that layout. It replaces the whole document, so it brings its own <html>.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased text-slate-900">
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div
            role="alert"
            className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200"
          >
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-slate-600">The app couldn&apos;t be loaded. Please try again.</p>
            <button
              onClick={() => retry()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
