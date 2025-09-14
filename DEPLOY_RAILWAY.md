# Deploy to Railway

This repo is pre-configured for Railway. Follow these steps to deploy and connect your Telegram bot webhook.

## 1) Prerequisites
- GitHub repo connected to Railway
- Telegram bot token (`TELEGRAM_BOT_TOKEN`)
- OpenAI API key (`OPENAI_API_KEY`) or compatible base URL (`OPENAI_BASE_URL`)

## 2) Build & Start
Already configured via `railway.json`:
- Build: `NODE_ENV=development npm ci && npm run build`
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
- With no DB env, the app uses a project-local file DB (`file:.local/mastra.db`) which is ephemeral on Railway

## 4) Deploy
1. Connect the repo to Railway and deploy.
2. Check logs; confirm the app is listening on the assigned `$PORT`.
3. Health check: `curl https://<service>.up.railway.app/healthz`

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
