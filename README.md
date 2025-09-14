# DailyVibeCode – Mastra Agent + Telegram Newsletter

A production‑ready Mastra agent app that delivers a Korean coding & AI‑agent newsletter to Telegram. It exposes a Telegram webhook, renders an inline menu, and runs a resilient workflow powered by Mastra + Inngest. Optimized for smooth local dev and one‑click deploy to Railway.

## ✨ Features
- Telegram webhook with inline buttons (오늘의 뉴스레터 받기, 도움말)
- Newsletter workflow with retries, message chunking, and HTML fallback
- Agent memory per chat via Mastra Storage (Postgres/LibSQL/File)
- Inngest integration: Cloud or self‑hosted dev engine sidecar
- Single command dev runner and Railway‑ready config + health check

## 🚀 Quick Start (Local)
1) Install
```bash
npm install
```
2) Env (create `.env.development` if needed)
```ini
PORT=5001
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
# Optional DB
# DATABASE_URL=postgresql://mastra:mastra@localhost:5432/mastra
# or Turso/LibSQL
# DATABASE_URL=libsql://<host>
# DATABASE_AUTH_TOKEN=<token>
```
3) Run dev (Mastra on :5001 + Inngest dev on :3000)
```bash
npm run dev:all
```
4) Expose your port and set Telegram webhook (example with ngrok):
```bash
ngrok http 5001
# Use the HTTPS URL from ngrok below
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<ngrok-domain>/webhooks/telegram/action" \
  -d 'allowed_updates=["message","callback_query"]' \
  -d "drop_pending_updates=true"
```
5) Test in Telegram
- Send `/start` to your bot → two buttons appear
- Click “오늘의 뉴스레터 받기”

## ☁️ Deploy to Railway
This repo ships with a `railway.json` and a health route.

- Build: `NODE_ENV=development npm install && npm run build`
- Start: `npm start` (production build) or `npm run start:inngest` (sidecar Inngest dev engine)
- Health: `GET /healthz`

Choose your workflow engine:
- Inngest Cloud (recommended for HA): set Railway env vars
  - `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
  - Optional: `INNGEST_SERVE_HOST=https://<your-domain>`
- Sidecar Inngest dev (no Cloud, simpler):
  - Start Command: `npm run start:inngest`
  - Env: `INNGEST_USE_DEV=true` (and optionally `INNGEST_BASE_URL=http://127.0.0.1:3000`)

See DEPLOY_RAILWAY.md for full, step‑by‑step instructions.

## 🔐 Environment Variables
Required
- `TELEGRAM_BOT_TOKEN` – your bot token
- `OPENAI_API_KEY` – for the newsletter agent

Optional
- `OPENAI_BASE_URL`, `OFFLINE_MODE=true`, `TELEGRAM_DEFAULT_CHAT_ID`
- DB (pick one)
  - Postgres: `DATABASE_URL=postgresql://...`
  - Turso/LibSQL: `DATABASE_URL=libsql://...`, `DATABASE_AUTH_TOKEN=...`
  - No DB set → file DB with writable path auto‑chosen: `DATA_DIR` → `/data` → `.local` → `/tmp`
- Inngest
  - Cloud: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, optional `INNGEST_SERVE_HOST`
  - Sidecar: `INNGEST_USE_DEV=true`, optional `INNGEST_BASE_URL`

## 🔔 Telegram Webhook
Set webhook (replace `<domain>` and ensure your app is running):
```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<domain>/webhooks/telegram/action" \
  -d 'allowed_updates=["message","callback_query"]' \
  -d "drop_pending_updates=true"
```
Check status / remove webhook
```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook?drop_pending_updates=true"
```

## 🧩 Architecture (High‑level)
```
Telegram ──▶ /webhooks/telegram/action ──▶ Mastra server (Hono)
                              │               │
                              │               ├─▶ /api/inngest (register workflows)
                              │               └─▶ Storage (Postgres/LibSQL/File)
                              ▼
                      Inngest engine (Cloud or local :3000)
                              │
                              ▼
                  Workflow steps → Agent → Telegram sendMessage
```

## 📁 Key Files
- `src/mastra/index.ts` – Mastra app config, routes, Telegram trigger handler, health
- `src/triggers/telegramTriggers.ts` – webhook shape + route registration
- `src/mastra/agents/koreanNewsletterAgent.ts` – newsletter agent + tools + memory
- `src/mastra/workflows/telegramNewsletterWorkflow.ts` – generate → split → send
- `src/mastra/storage/index.ts` – storage selection with writable fallback
- `src/mastra/inngest/index.ts` – Inngest integration wiring
- `src/mastra/inngest/client.ts` – Inngest client; env can force dev engine
- `scripts/dev-all.mjs` – local dev: app + Inngest dev
- `scripts/start-with-inngest.mjs` – prod app + Inngest dev sidecar (Railway)

## 🛠️ Endpoints
- `POST /webhooks/telegram/action` – Telegram updates
- `ALL  /api/inngest` – Inngest function registration endpoint
- `GET  /healthz` – health check
- Dev‑only playground (UI) appears when running `mastra dev` locally.

## 🧰 Troubleshooting
- Inngest “Failed to send event…” in prod
  - Set `INNGEST_EVENT_KEY` (and `INNGEST_SIGNING_KEY`) for Cloud OR run sidecar mode (`npm run start:inngest`, `INNGEST_USE_DEV=true`).
- Telegram `answerCallbackQuery` 400
  - Often benign (“query is too old/invalid”). Try with a fresh button after resetting webhook.
- SQLite open error (file DB)
  - Provide a writable path: set `DATA_DIR=/data` (with a Railway Volume) or use Postgres.
- Only “Welcome to Mastra” page in prod
  - The dev playground is disabled in production. Use API/webhook, or run dev mode/start sidecar if you need a UI.

## 🗺️ Roadmap
- Scheduled newsletter broadcasts (cron)
- Subscriber model and preferences
- Webhook helper scripts (set/get/unset)
- Optional auth for prod UI

## 📚 More Docs
- `DEPLOY_RAILWAY.md` – complete Railway guide
- `DATABASE.md` – why/which DB and fallback paths
- `AGENTS.md` – abbreviations, what’s done, and session cautions

---
Built with ❤️ using Mastra, Inngest, and Telegram Bot API.
