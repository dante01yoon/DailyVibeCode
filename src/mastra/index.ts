import { Mastra } from "@mastra/core";
import { MastraError } from "@mastra/core/error";
import { PinoLogger } from "@mastra/loggers";
import { LogLevel, MastraLogger } from "@mastra/core/logger";
import pino from "pino";
import { MCPServer } from "@mastra/mcp";
import { NonRetriableError } from "inngest";
import { z } from "zod";

import { sharedStorage } from "./storage";
import { inngest, inngestServe } from "./inngest";
import { koreanNewsletterAgent } from "./agents/koreanNewsletterAgent";
import { telegramNewsletterWorkflow } from "./workflows/telegramNewsletterWorkflow";
import { registerTelegramTrigger } from "../triggers/telegramTriggers";
import axios from "axios";
import { hackerNewsTool } from "./tools/hackerNewsTool";
import { githubTrendingTool } from "./tools/githubTrendingTool";
import { devTipsTool } from "./tools/devTipsTool";
import { format } from "node:util";

class ProductionPinoLogger extends MastraLogger {
  protected logger: pino.Logger;

  constructor(
    options: {
      name?: string;
      level?: LogLevel;
    } = {},
  ) {
    super(options);

    this.logger = pino({
      name: options.name || "app",
      level: options.level || LogLevel.INFO,
      base: {},
      formatters: {
        level: (label: string, _number: number) => ({
          level: label,
        }),
      },
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    });
  }

  debug(message: string, args: Record<string, any> = {}): void {
    this.logger.debug(args, message);
  }

  info(message: string, args: Record<string, any> = {}): void {
    this.logger.info(args, message);
  }

  warn(message: string, args: Record<string, any> = {}): void {
    this.logger.warn(args, message);
  }

  error(message: string, args: Record<string, any> = {}): void {
    this.logger.error(args, message);
  }
}

export const mastra = new Mastra({
  storage: sharedStorage,
  agents: { koreanNewsletterAgent },
  workflows: { telegramNewsletterWorkflow },
  mcpServers: {
    allTools: new MCPServer({
      name: "allTools",
      version: "1.0.0",
      tools: {
        hackerNewsTool,
        githubTrendingTool,
        devTipsTool,
      },
    }),
  },
  bundler: {
    // A few dependencies are not properly picked up by
    // the bundler if they are not added directly to the
    // entrypoint.
    externals: [
      "@slack/web-api",
      "inngest",
      "inngest/hono",
      "hono",
      "hono/streaming",
    ],
    // sourcemaps are good for debugging.
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT ?? 5000),
    middleware: [
      async (c, next) => {
        const mastra = c.get("mastra");
        const logger = mastra?.getLogger();
        logger?.debug("[Request]", { method: c.req.method, url: c.req.url });
        try {
          await next();
        } catch (error) {
          logger?.error("[Response]", {
            method: c.req.method,
            url: c.req.url,
            error,
          });
          if (error instanceof MastraError) {
            if (error.id === "AGENT_MEMORY_MISSING_RESOURCE_ID") {
              // This is typically a non-retirable error. It means that the request was not
              // setup correctly to pass in the necessary parameters.
              throw new NonRetriableError(error.message, { cause: error });
            }
          } else if (error instanceof z.ZodError) {
            // Validation errors are never retriable.
            throw new NonRetriableError(error.message, { cause: error });
          }

          throw error;
        }
      },
    ],
    apiRoutes: [
      // This API route is used to register the Mastra workflow (inngest function) on the inngest server
      {
        path: "/api/inngest",
        method: "ALL",
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
        // The inngestServe function integrates Mastra workflows with Inngest by:
        // 1. Creating Inngest functions for each workflow with unique IDs (workflow.${workflowId})
        // 2. Setting up event handlers that:
        //    - Generate unique run IDs for each workflow execution
        //    - Create an InngestExecutionEngine to manage step execution
        //    - Handle workflow state persistence and real-time updates
        // 3. Establishing a publish-subscribe system for real-time monitoring
        //    through the workflow:${workflowId}:${runId} channel
      },
      // Simple health check for Railway and other platforms
      {
        path: "/healthz",
        method: "GET",
        handler: async (c) => {
          const uptime = typeof process !== "undefined" && typeof process.uptime === "function" ? process.uptime() : 0;
          return c.json({ status: "ok", uptime });
        },
      },
      ...registerTelegramTrigger({
        triggerType: "telegram/update",
        handler: async (mastra, triggerInfo) => {
          const logger = mastra.getLogger();
          logger?.info("📝 [Telegram Trigger] 업데이트 수신", { type: triggerInfo.type });

          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          const rawChatId = triggerInfo.payload?.message?.chat?.id ??
            triggerInfo.payload?.callback_query?.message?.chat?.id ??
            process.env.TELEGRAM_DEFAULT_CHAT_ID;
          if (!rawChatId) {
            logger?.error("❌ [Telegram Trigger] chatId를 확인할 수 없습니다");
            return;
          }
          const chatId = String(rawChatId);

          // Send inline keyboard on /start or 'menu'
          const text = triggerInfo.payload?.message?.text;
          if ((text === "/start" || text?.toLowerCase() === "menu") && botToken) {
            try {
              await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: "무엇을 도와드릴까요? 아래 버튼을 눌러주세요.",
                reply_markup: {
                  inline_keyboard: [[
                    { text: "오늘의 뉴스레터 받기", callback_data: "GET_NEWSLETTER" },
                    { text: "도움말", callback_data: "HELP" }
                  ]]
                }
              });
              logger?.info("✅ [Telegram Trigger] 메뉴 전송 완료", { chatId });
              return;
            } catch (err) {
              logger?.error("❌ [Telegram Trigger] 메뉴 전송 실패", { error: err instanceof Error ? err.message : String(err) });
              // fall through to default behavior
            }
          }

          // Handle button callbacks
          if (triggerInfo.type === "telegram/callback" && botToken) {
            const data = triggerInfo.payload?.callback_query?.data as string | undefined;
            const callbackQueryId = triggerInfo.payload?.callback_query?.id as string | undefined;
            if (callbackQueryId) {
              try {
                await axios.post(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                  callback_query_id: callbackQueryId,
                }, { timeout: 5000 });
              } catch (e: any) {
                const status = e?.response?.status;
                const tg = e?.response?.data;
                const description = tg?.description;
                const isIgnorable = status === 400 && typeof description === "string" && /query is too old|invalid/i.test(description);
                // Log richer diagnostic; continue regardless so the workflow still runs.
                logger?.[isIgnorable ? "info" : "warn"](
                  "⚠️ [Telegram Trigger] answerCallbackQuery 실패",
                  {
                    status,
                    description,
                    error_code: tg?.error_code,
                  },
                );
              }
            }

            if (data === "GET_NEWSLETTER") {
              try {
                const run = await mastra.getWorkflow("telegramNewsletterWorkflow").createRunAsync();
                await run.start({
                  inputData: {
                    message: "button:GET_NEWSLETTER",
                    threadId: `telegram/${chatId}`,
                    chatId,
                  }
                });
                logger?.info("✅ [Telegram Trigger] 버튼 클릭 워크플로우 실행 완료", { chatId });
              } catch (error) {
                logger?.error("❌ [Telegram Trigger] 버튼 클릭 워크플로우 실행 실패", { error: error instanceof Error ? error.message : String(error) });
              }
              return;
            }

            if (data === "HELP") {
              try {
                await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  chat_id: chatId,
                  text: "도움말: '오늘의 뉴스레터 받기' 버튼을 눌러 최신 바이브 코딩 & AI 에이전트 뉴스레터를 받아보세요.",
                });
              } catch {}
              return;
            }
          }

          // Default: start workflow for any message
          try {
            const run = await mastra.getWorkflow("telegramNewsletterWorkflow").createRunAsync();
            await run.start({
              inputData: {
                message: JSON.stringify(triggerInfo.payload),
                threadId: `telegram/${chatId}`,
                chatId,
              }
            });
            logger?.info("✅ [Telegram Trigger] 워크플로우 실행 완료");
          } catch (error) {
            logger?.error("❌ [Telegram Trigger] 워크플로우 실행 실패:", { 
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        },
      }),
    ],
  },
  logger:
    process.env.NODE_ENV === "production"
      ? new ProductionPinoLogger({
          name: "Mastra",
          level: "info",
        })
      : new PinoLogger({
          name: "Mastra",
          level: "info",
        }),
});

/*  Sanity check 1: Throw an error if there are more than 1 workflows.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getWorkflows()).length > 1) {
  throw new Error(
    "More than 1 workflows found. Currently, more than 1 workflows are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}

/*  Sanity check 2: Throw an error if there are more than 1 agents.  */
// !!!!!! Do not remove this check. !!!!!!
if (Object.keys(mastra.getAgents()).length > 1) {
  throw new Error(
    "More than 1 agents found. Currently, more than 1 agents are not supported in the UI, since doing so will cause app state to be inconsistent.",
  );
}
