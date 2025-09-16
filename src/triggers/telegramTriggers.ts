import type { ContentfulStatusCode } from "hono/utils/http-status";

import { registerApiRoute } from "../mastra/inngest";
import { Mastra } from "@mastra/core";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn(
    "Trying to initialize Telegram triggers without TELEGRAM_BOT_TOKEN. Can you confirm that the Telegram integration is configured correctly?",
  );
}

export type TriggerInfoTelegram = {
  type: "telegram/message" | "telegram/callback";
  params: {
    userName: string;
    message: string; // text for message updates, callback_data for callback updates
  };
  payload: any;
};

export function registerTelegramTrigger({
  triggerType,
  handler,
}: {
  triggerType: string; // kept for compatibility; actual type is derived from payload
  handler: (mastra: Mastra, triggerInfo: TriggerInfoTelegram) => Promise<void>;
}) {
  return [
    registerApiRoute("/webhooks/telegram/action", {
      method: "POST",
      handler: async (c) => {
        const mastra = c.get("mastra");
        const logger = mastra.getLogger();
        try {
          const payload = await c.req.json();

          logger?.info("📝 [Telegram] payload", payload);

          const isCallback = Boolean(payload?.callback_query);
          const info: TriggerInfoTelegram = {
            type: isCallback ? "telegram/callback" : "telegram/message",
            params: {
              userName: isCallback
                ? payload.callback_query?.from?.username
                : payload.message?.from?.username,
              message: isCallback
                ? payload.callback_query?.data
                : payload.message?.text,
            },
            payload,
          };

          await handler(mastra, info);

          return c.text("OK", 200);
        } catch (error) {
          logger?.error("Error handling Telegram webhook:", error);
          return c.text("Internal Server Error", 500);
        }
      },
    }),
  ];
}
