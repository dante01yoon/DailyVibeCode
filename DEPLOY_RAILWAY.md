# Deploy to Railway

This repo is pre-configured for Railway. Follow these steps to deploy and connect your Telegram bot webhook.

## 1) Prerequisites
- GitHub repo connected to Railway
- Telegram bot token (`TELEGRAM_BOT_TOKEN`)
- OpenAI API key (`OPENAI_API_KEY`) or compatible base URL (`OPENAI_BASE_URL`)

## 2) Build & Start
Already configured via `railway.json`:
- Build: `NODE_ENV=development npm install && npm run build`
- Start: `npm start`
- Health: `GET /healthz`

The app listens on `0.0.0.0:$PORT`.

## 3) Environment Variables
Required:
- `TELEGRAM_BOT_TOKEN`
- `OPENAI_API_KEY`

Optional:
- `OPENAI_BASE_URL` — if using a proxy
- `OFFLINE_MODE=true` — disables external fetches; sends fallback content
- `TELEGRAM_DEFAULT_CHAT_ID` — for manual testing without a live update

Database:
- Attach Railway Postgres (recommended for persistence): `DATABASE_URL` auto-injected (starts with `postgres`)
- Or use Turso/LibSQL: set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`
- With no DB env, the app falls back to a local file DB at a writable path:
  - Prefers `DATA_DIR` if set, else `/data` (Railway volume), else `.local`, else `/tmp`.
  - Example: set `DATA_DIR=/data` in Railway if you attach a volume.

## 4) Deploy
1. Connect the repo to Railway and deploy.
2. Check logs; confirm the app is listening on the assigned `$PORT`.
3. Health check: `curl https://<service>.up.railway.app/healthz`

## 4.1) Inngest Cloud Keys (Production)
The production build uses Inngest to run workflows. In production, you must provide Inngest keys so events can be sent and verified.

- Get keys from Inngest Cloud:
  - Sign in at https://app.inngest.com
  - Create an App (or use an existing one) and select an Environment (e.g., `production`).
  - From the Environment → Settings/Keys:
    - Copy the Event Key
    - Copy the Signing Key
- Set these in Railway (Service → Variables):
  - `INNGEST_EVENT_KEY=<paste-event-key>`
  - `INNGEST_SIGNING_KEY=<paste-signing-key>`
- Redeploy. The error “Failed to send event… We couldn't find an event key” will disappear once `INNGEST_EVENT_KEY` is set.
- Optional: If workflows don’t start after events are sent, make sure Inngest Cloud can reach your app. Set
  - `INNGEST_SERVE_HOST=https://<your-domain>` (e.g., `https://dailyvibecode-production.up.railway.app`)
  and let us know to wire this env into the server config if needed.

## 4.2) Run Inngest locally on Railway (no Cloud)
If you don’t want to use Inngest Cloud, you can run the Inngest dev server as a sidecar inside your Railway service.

- What this does: Your app runs normally on `$PORT`, and an internal Inngest dev server runs on `127.0.0.1:3000`. The app talks to it via `http://localhost:3000`.
- Tradeoffs: The dev server is not a production-grade queue. It’s fine for small apps and demos, but not HA.

Steps:
1) Start command (Railway → Settings → Build & Start):
   - Start: `npm run start:inngest`
2) Env vars (Railway → Variables):
   - `INNGEST_USE_DEV=true` (forces the app to use the local Inngest engine even in production)
   - Optional: `INNGEST_BASE_URL=http://127.0.0.1:3000` (overrides the default dev URL)
3) Deploy. Logs should show both “app” and “inngest” processes.

You do NOT need `INNGEST_EVENT_KEY` when using the local dev engine.

## 5) Telegram Webhook
After deploy, set the webhook to your Railway URL:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<service>.up.railway.app/webhooks/telegram/action" \
  -d 'allowed_updates=["message","callback_query"]' \
  -d "drop_pending_updates=true"
```

Check webhook status:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Remove webhook (optional):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
```

## 6) Test
1. Send `/start` to your bot → two buttons appear: “오늘의 뉴스레터 받기”, “도움말”.
2. Click “오늘의 뉴스레터 받기” → workflow runs and replies in the chat.

## Notes
- Inngest dev tooling (`scripts/inngest.sh`, `:3000`) is for local development only. In production, workflows are served via `/api/inngest`.
- Node version is pinned in `package.json` (`engines.node >= 20.9.0`).
- Keep secrets out of git; set them in Railway.
