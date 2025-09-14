import { PostgresStore } from "@mastra/pg";
import { LibSQLStore } from "@mastra/libsql";

// Choose storage based on DATABASE_URL. Defaults to local file-based LibSQL.
// - postgres*: use PostgresStore
// - libsql:, file:, :memory: use LibSQLStore
const dbUrl = process.env.DATABASE_URL;

function createStorage() {
  if (dbUrl && /^postgres/i.test(dbUrl)) {
    console.log('postgresstore: ', new PostgresStore({ connectionString: dbUrl }));
    return new PostgresStore({ connectionString: dbUrl });
  }
  if (dbUrl) {
    return new LibSQLStore({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  // Fallback for local dev: persist to project-local file
  return new LibSQLStore({ url: "file:.local/mastra.db" });
}

export const sharedStorage = createStorage();
