# Agents Guide (Abbrev + What’s Done + Cautions)

This repo implements a Telegram-driven newsletter agent using Mastra + Inngest. Use this page as a quick orientation and a checklist for the next session.

## Abbreviations
- MS: Mastra (core server, agents, workflows)
- IG: Inngest (workflow runtime/engine)
- TG: Telegram Bot (webhook → triggers)
- RW: Railway (hosting)
- PG: Postgres (Mastra storage)
- LSQL: LibSQL/Turso (Mastra storage)

## Architecture (1‑minute tour)
- HTTP server: `src/mastra/index.ts:62`
  - Exposes `/webhooks/telegram/action`, `/api/inngest`, `/healthz`.
- Agent: `src/mastra/agents/koreanNewsletterAgent.ts:14`
  - Uses OpenAI via AI SDK, tools (HN, GitHub Trending, Dev Tips), and Mastra Memory with shared storage.
- Workflow: `src/mastra/workflows/telegramNewsletterWorkflow.ts:1`
  - Orchestrates agent call, splits long messages, Telegram send with retry/fallback.
- Triggers: `src/triggers/telegramTriggers.ts:21`
  - Parses `message` and `callback_query`; handler lives in `src/mastra/index.ts:146`.
- Storage: `src/mastra/storage/index.ts:1`
  - PG if `DATABASE_URL` starts with `postgres`, else LSQL. Fallback chooses writable dir: `DATA_DIR` → `/data` → `.local` → `/tmp`.
- Inngest integration: `src/mastra/inngest/index.ts:1`, client `src/mastra/inngest/client.ts:1`
  - Dev: proxies through local IG dev server (default `http://localhost:3000`).
  - Prod: IG Cloud unless forced to dev via env.

## What’s Done
- TG webhook and inline keyboard
  - `/start` sends two buttons: “오늘의 뉴스레터 받기”, “도움말”.
  - Button click runs `telegramNewsletterWorkflow` with `threadId=telegram/<chatId>`.
- Workflow hardening
  - OFFLINE_MODE path; message chunking; HTML parse_mode fallback; request timeouts.
- Deployability
  - `railway.json` with build/start + `/healthz`.
  - `DEPLOY_RAILWAY.md` (step‑by‑step) and `DATABASE.md` (why/which DB).
- Storage fallback fix
  - Create writable dir automatically; supports Railway volume via `DATA_DIR=/data`.
- IG modes
  - Cloud mode docs + keys section.
  - Sidecar mode: `scripts/start-with-inngest.mjs` and env toggles in `src/mastra/inngest/client.ts` (`INNGEST_USE_DEV`, `INNGEST_BASE_URL`).
- TG callback ack logging
  - Rich diagnostics for 400s (often harmless/stale query).

## How To Run
- Local dev (recommended):
  - `npm run dev:all` → starts Mastra on `:5001` + IG dev on `:3000`.
- Production on Railway (two choices):
  1) IG Cloud: keep `npm start`, set `INNGEST_EVENT_KEY` (+ `INNGEST_SIGNING_KEY`).
  2) Sidecar IG dev: `npm run start:inngest`, set `INNGEST_USE_DEV=true` (no keys needed).

## Env Checklist
- Required: `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`
- Optional: `OPENAI_BASE_URL`, `OFFLINE_MODE`, `TELEGRAM_DEFAULT_CHAT_ID`
- DB:
  - Postgres: `DATABASE_URL=postgresql://…`
  - Turso/LibSQL: `DATABASE_URL=libsql://…`, `DATABASE_AUTH_TOKEN=…`
  - Fallback path priority: `DATA_DIR` → `/data` → `.local` → `/tmp`
- Inngest:
  - Cloud: `INNGEST_EVENT_KEY` (+ `INNGEST_SIGNING_KEY`), optional `INNGEST_SERVE_HOST=https://<domain>`
  - Sidecar: `INNGEST_USE_DEV=true`, optional `INNGEST_BASE_URL=http://127.0.0.1:3000`

## Webhook
- TG setWebhook to `https://<domain>/webhooks/telegram/action`.
- If token changes or you see stale query errors, `deleteWebhook?drop_pending_updates=true` then set again.

## Guardrails & Cautions
- Secrets: Don’t commit `.env.development` or tokens. Configure in Railway.
- Storage durability:
  - `.local` or `/tmp` is ephemeral on RW; attach Postgres or a volume (`DATA_DIR=/data`) for persistence.
- Inngest mode:
  - Sidecar dev engine is fine for demos/small scale; for HA/scale use IG Cloud.
- Message limits: Telegram `sendMessage` caps text length; we split into chunks.
- Single‑agent/single‑workflow sanity checks: see `src/mastra/index.ts:258` and `src/mastra/index.ts:266`.
- 400 on `answerCallbackQuery` is often benign (“query is too old”). We log description and continue.

## Next Session (Focus)
- Cron/scheduled newsletter broadcasts via IG (`registerCronWorkflow`) with opt‑in subscribers.
- Subscriber model: persist TG chat IDs + preferences.
- Webhook scripts: npm tasks for set/get/unset.
- Optional: Add auth for prod playground if you enable `mastra dev` in prod.
- Telemetry/observability: export traces/logs or hook to your APM.

## Quick Links
- Health: `/healthz`
- Inngest route: `/api/inngest`
- TG webhook: `/webhooks/telegram/action`

