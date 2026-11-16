import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  // Same default as lib/db/index.ts, so db:studio opens the database the app is using.
  dbCredentials: { url: process.env.DATABASE_PATH ?? './data/app.db' },
});
