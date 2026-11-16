import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      // The real entry throws outside a React Server environment; Next resolves to this same empty file on the server.
      'server-only': `${root}node_modules/server-only/empty.js`,
    },
  },
  test: {
    environment: 'node',
    // Keeps the shared `db` singleton off the real data/app.db when a test imports lib/db.
    env: { DATABASE_PATH: ':memory:' },
  },
});
