import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

// Allow forcing dev engine even in production using env flags.
// - INNGEST_USE_DEV=true forces dev mode
// - INNGEST_BASE_URL overrides the dev engine base URL (default http://localhost:3000)
const forceDev = process.env.INNGEST_USE_DEV === "true" || !!process.env.INNGEST_BASE_URL;
const isProd = process.env.NODE_ENV === "production";
const useDev = !isProd || forceDev;
const devBaseUrl = process.env.INNGEST_BASE_URL || "http://localhost:3000";

export const inngest = new Inngest(
  useDev
    ? {
        id: "mastra",
        baseUrl: devBaseUrl,
        isDev: true,
        middleware: [realtimeMiddleware()],
      }
    : {
        id: "replit-agent-workflow",
        name: "Replit Agent Workflow System",
      },
);
