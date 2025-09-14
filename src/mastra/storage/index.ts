import { PostgresStore } from "@mastra/pg";
import { LibSQLStore } from "@mastra/libsql";
import fs from "node:fs";
import path from "node:path";

// Choose storage based on DATABASE_URL. Defaults to local file-based LibSQL.
// - postgres*: use PostgresStore
// - libsql:, file:, :memory: use LibSQLStore
const dbUrl = process.env.DATABASE_URL;

function createStorage() {
  if (dbUrl && /^postgres/i.test(dbUrl)) {
    return new PostgresStore({ connectionString: dbUrl });
  }
  if (dbUrl) {
    return new LibSQLStore({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  // Fallback: use a writable data directory.
  // Priority:
  // 1) DATA_DIR env (if provided)
  // 2) /data (Railway volume, if attached)
  // 3) .local (project-local, for dev)
  // 4) /tmp (always writable but ephemeral)
  const candidates = [
    process.env.DATA_DIR,
    "/data",
    path.join(process.cwd(), ".local"),
    "/tmp",
  ].filter(Boolean) as string[];

  let chosenDir = candidates[0]!;
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      chosenDir = dir;
      break;
    } catch {
      // try next
    }
  }

  const filePath = path.join(chosenDir, "mastra.db");
  const url = `file:${filePath}`;
  return new LibSQLStore({ url });
}

export const sharedStorage = createStorage();
