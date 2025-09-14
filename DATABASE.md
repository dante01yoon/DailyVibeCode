# Database: Why This App Needs One

This app uses Mastra agents and workflows to generate and deliver a Telegram newsletter. A database connection is required for reliability, continuity between messages, and safe workflow orchestration.

## What The DB Is Used For
- Agent memory: Persists conversation threads and recent messages so the agent keeps context across requests.
  - Code: `src/mastra/agents/koreanNewsletterAgent.ts:49` uses `new Memory({ storage: sharedStorage })`.
  - The thread key is tied to Telegram chat ID (e.g., `threadId: telegram/<chatId>`), so each chat has its own context.
- Workflow state: Stores workflow runs, step inputs/outputs, and logs to enable retries, observability, and post‑restart recovery.
  - Code: `src/mastra/index.ts:62` passes `storage: sharedStorage` to Mastra; workflows are executed via Inngest integration and rely on storage for state.
- Idempotency and safety: Storage makes it possible to avoid duplicate processing of the same trigger and to resume after failures without losing state. This is especially important for webhooks and retries.
- Future features: Subscriber lists, preferences, scheduled pushes, and audit logs all need durable storage.

## Where The Thread Context Comes From
- Telegram triggers compute a chat‑scoped thread ID: `threadId: \`telegram/${chatId}\``.
  - Code: `src/mastra/index.ts:204` and `src/mastra/index.ts:232` include the threadId when starting the newsletter workflow.
  - The workflow passes this `threadId` to the agent so its memory is keyed per chat.

## Backends Supported
- Postgres: Recommended for production; durable, multi‑instance friendly.
  - Set `DATABASE_URL=postgresql://user:pass@host:5432/db`.
- LibSQL / Turso: Remote SQLite over HTTP for lightweight deployments.
  - Set `DATABASE_URL=libsql://<host>` and `DATABASE_AUTH_TOKEN=<token>`.
- File‑based LibSQL (SQLite): Used for local dev or ephemeral environments.
  - If no `DATABASE_URL` is provided, the app selects a writable path automatically.

## Selection Logic
- Code: `src/mastra/storage/index.ts:11` chooses the storage based on `DATABASE_URL`.
  - `postgres*` → Postgres
  - `libsql:`, `file:`, `:memory:` → LibSQL
  - No `DATABASE_URL` → fallback to a writable file DB.
- Fallback path priority (auto‑created): `DATA_DIR` → `/data` → `.local` → `/tmp`.
  - Code: `src/mastra/storage/index.ts:21`–`47` creates the directory and uses `file:<dir>/mastra.db`.

## Railway Notes
- For persistence without Postgres, attach a Railway Volume and set `DATA_DIR=/data` so the fallback uses a durable path.
- Recommended: Attach Railway Postgres so `DATABASE_URL` is injected and the app uses Postgres automatically.

## No Manual Migrations Needed
Mastra’s stores manage their own schema. You don’t need to run migrations—just set the env vars and run the app.

## Env Summary
- `DATABASE_URL` (required for Postgres or Turso/LibSQL)
- `DATABASE_AUTH_TOKEN` (required for Turso/LibSQL)
- `DATA_DIR` (optional; controls fallback file DB location)

## Key References
- Storage selection: `src/mastra/storage/index.ts:11`
- Mastra uses storage: `src/mastra/index.ts:62`
- Agent memory uses storage: `src/mastra/agents/koreanNewsletterAgent.ts:49`
- Thread scoping by chat: `src/mastra/index.ts:204` and `src/mastra/index.ts:232`
