# Telegram + Mastra Project Progress

Goal: Telegram bot with inline buttons that trigger a newsletter workflow; easy local dev, optional Postgres, production‑ready wiring.

## Current Status

### Done
- Telegram webhook endpoint handles messages and button clicks
  - `src/triggers/telegramTriggers.ts:1` parses `message` and `callback_query` into a single trigger shape.
  - `src/mastra/index.ts:1` wires the handler, derives `chatId`, and routes clicks to the workflow.
- Inline keyboard and click → workflow
  - On `/start` or `menu`, bot sends two buttons: “오늘의 뉴스레터 받기”, “도움말”.
  - On click `GET_NEWSLETTER`, app acknowledges the callback and starts `telegramNewsletterWorkflow` with `threadId=telegram/<chatId>`.
- Newsletter workflow hardened
  - `src/mastra/workflows/telegramNewsletterWorkflow.ts:1`: OFFLINE_MODE fallback for agent fetch failures.
  - Splits long messages; Telegram send has timeout + HTML‑parse retry without `parse_mode`.
- Dev UX
  - Single command dev runner: `scripts/dev-all.mjs:1` (starts app on `:5001` and Inngest on `:3000`).
  - Inngest script fixed to use `inngest` binary with PATH fallback: `scripts/inngest.sh:1`.
  - Ports unified via `PORT` env; Inngest forwarding respects it.
- Storage selection
  - `src/mastra/storage/index.ts:1`: selects Postgres if `DATABASE_URL` starts with `postgres`, else LibSQL (file DB by default).
  - Docker Compose for Postgres: `docker-compose.yml:1`; npm scripts for DB lifecycle.

### In Progress
- None actively in code. Next planned step is a cron‑based newsletter push (see below).

### Not Done (Backlog)
- Scheduled/cron newsletter (Step 2): trigger workflow at intervals.
- Subscriber model: store chat IDs and preferences; `/subscribe` `/unsubscribe`.
- Helper commands: `/id` to echo chatId, `/menu` convenience.
- Webhook automation: scripts to set/unset/get webhook.
- Broader menu trigger (show buttons on first message), richer button set.
- Tests and deeper validation of Telegram payload variants.

## How It Works
- Webhook: Telegram → `POST /webhooks/telegram/action`
  - Message → send menu on `/start` or default to workflow.
  - Callback → acknowledge via `answerCallbackQuery` and start workflow if `GET_NEWSLETTER`.
- Workflow: Generates (or falls back) and sends messages back to the same `chatId` via Bot API.

## Dev Commands
- Start everything: `npm run dev:all`
- App only: `npm run dev` (PORT=5001)
- Inngest only: `npm run inngest:dev`
- Postgres (optional): `npm run db:up` | `npm run dev:pg`

## Env Checklist
- Required for Telegram send: `TELEGRAM_BOT_TOKEN`
- Optional helpers: `OFFLINE_MODE=true`, `TELEGRAM_DEFAULT_CHAT_ID=<id>`
- DB:
  - Default dev: no env (uses `file:.local/mastra.db`)
  - Postgres: `DATABASE_URL=postgresql://mastra:mastra@localhost:5432/mastra`
  - Turso/LibSQL: `DATABASE_URL=libsql://...`, `DATABASE_AUTH_TOKEN=...`

## Webhook Setup (Dev)
1) Run servers: `npm run dev:all`
2) Expose `:5001` via HTTPS (e.g., ngrok): `ngrok http 5001`
3) Set webhook:
   `curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d "url=https://<your-domain>/webhooks/telegram/action" \
     -d 'allowed_updates=["message","callback_query"]' \
     -d "drop_pending_updates=true"`

## Next Session Guide (Step 2: Cron + Broadcast)
Simple plan to add scheduled newsletters and optional broadcasting.

1) Implement a cron trigger
   - Option A (Mastra helper): use `registerCronWorkflow('0 9 * * *', telegramNewsletterWorkflow)` to run daily at 09:00.
   - Option B (Inngest): add a scheduled function that creates a run for `telegramNewsletterWorkflow`.

2) Choose target chats
   - Minimal: read `TELEGRAM_BROADCAST_CHAT_IDS` (comma‑separated) from env and iterate.
   - Better: create a subscribers table (LibSQL/Postgres), add `/subscribe` `/unsubscribe` commands to manage it.

3) Send/broadcast
   - For each chatId, start the workflow with `{ message: 'cron', threadId: 'telegram/<id>', chatId }`.

4) Optional niceties
   - Add `/id` command to reply with the user’s chatId.
   - Relax menu condition to show on any first message.
   - Add scripts: `scripts/telegram-webhook.mjs` for set/unset/info helper.

## File Map (Key Files)
- `src/triggers/telegramTriggers.ts:1` — Webhook parsing for message/callback updates.
- `src/mastra/index.ts:1` — Server setup, Telegram trigger handler, menu + callback logic, workflow start.
- `src/mastra/workflows/telegramNewsletterWorkflow.ts:1` — Agent step, Telegram send step.
- `src/mastra/inngest/index.ts:1` — Inngest integration and serve helpers.
- `src/mastra/inngest/client.ts:1` — Inngest dev client (baseUrl `:3000`).
- `src/mastra/storage/index.ts:1` — Storage selection (Postgres/LibSQL).
- `scripts/inngest.sh:1` — Inngest dev launcher.
- `scripts/dev-all.mjs:1` — Run app and Inngest together.
- `docker-compose.yml:1` — Local Postgres.

## Quick Checks
- Webhook status: `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"`
- Token valid: `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"`
- Local menu test: `curl -X POST http://localhost:5001/webhooks/telegram/action -H "Content-Type: application/json" -d '{"message":{"text":"/start","chat":{"id":<chat_id>}}}'`

