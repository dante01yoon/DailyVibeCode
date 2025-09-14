import { createWorkflow, createStep } from "../inngest";
import { koreanNewsletterAgent } from "../agents/koreanNewsletterAgent";
import { z } from "zod";
import axios from "axios";

// Step 1: Use the Korean newsletter agent (ONLY call agent.generate)
const useAgentStep = createStep({
  id: "use-newsletter-agent",
  description: "한국어 뉴스레터 에이전트를 사용하여 최신 코딩 뉴스레터 생성",
  inputSchema: z.object({
    message: z.string(),
    threadId: z.string(),
    chatId: z.string(),
  }),
  outputSchema: z.object({
    response: z.string(),
    chatId: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📝 [Workflow] 뉴스레터 에이전트 사용 시작");

    const offline = process.env.OFFLINE_MODE === "true";
    if (offline) {
      logger?.warn("⚠️ [Workflow] OFFLINE_MODE 활성화: 기본 텍스트 사용");
      return {
        response: `📰 오프라인 모드 안내\n\n네트워크 연결 없이 실행 중입니다.\n- 에이전트 생성 결과 대신 기본 안내를 전송합니다.\n- 원문 메시지: ${inputData.message.substring(0, 200)}${
          inputData.message.length > 200 ? "…" : ""
        }\n\n환경 변수 OFFLINE_MODE=false로 비활성화 후 다시 시도하세요.`,
        chatId: inputData.chatId,
      };
    }

    try {
      // Generate newsletter using the agent (ONLY agent logic)
      const { text } = await koreanNewsletterAgent.generate(
        [
          {
            role: "user",
            content:
              "안녕하세요! 오늘의 코딩 뉴스레터를 작성해주세요. 최신 기술 뉴스, 트렌딩 저장소, 그리고 유용한 개발 팁들을 포함하여 흥미롭고 유용한 내용으로 구성해주세요.",
          },
        ],
        {
          resourceId: "bot",
          threadId: inputData.threadId,
          maxSteps: 5, // Allow multiple tool calls
        },
      );

      logger?.info("✅ [Workflow] 뉴스레터 생성 완료");

      return {
        response: text,
        chatId: inputData.chatId,
      };
    } catch (error) {
      logger?.error("❌ [Workflow] 에이전트 생성 실패", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        response:
          "⚠️ 에이전트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        chatId: inputData.chatId,
      };
    }
  }
});

// Step 2: Send the response to Telegram (ONLY messaging logic)
const sendTelegramMessageStep = createStep({
  id: "send-telegram-message",
  description: "생성된 뉴스레터를 텔레그램으로 전송",
  inputSchema: z.object({
    response: z.string(),
    chatId: z.string(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.number().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📝 [Workflow] 텔레그램 메시지 전송 시작", { chatId: inputData.chatId });
    
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken) {
        logger?.error("❌ [Workflow] TELEGRAM_BOT_TOKEN이 설정되지 않음");
        return { sent: false };
      }
      
      // Split long messages into chunks (Telegram has a 4096 character limit)
      const maxLength = 4000;
      const messages: string[] = [];
      
      if (inputData.response.length <= maxLength) {
        messages.push(inputData.response);
      } else {
        let currentMessage = "";
        const lines = inputData.response.split('\n');
        
        for (const line of lines) {
          if (currentMessage.length + line.length + 1 <= maxLength) {
            currentMessage += (currentMessage ? '\n' : '') + line;
          } else {
            if (currentMessage) {
              messages.push(currentMessage);
              currentMessage = line;
            } else {
              // Line itself is too long, split it
              messages.push(line.substring(0, maxLength));
              currentMessage = line.substring(maxLength);
            }
          }
        }
        if (currentMessage) {
          messages.push(currentMessage);
        }
      }
      
      let lastMessageId: number | undefined;
      
      // Send each message chunk with graceful fallback if HTML parse fails
      for (const message of messages) {
        try {
          const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              chat_id: inputData.chatId,
              text: message,
              parse_mode: "HTML",
            },
            { timeout: 15000 },
          );

          if (response.data?.ok) {
            lastMessageId = response.data.result?.message_id;
            logger?.info("✅ [Workflow] 텔레그램 메시지 전송 성공");
          } else {
            logger?.error("❌ [Workflow] 텔레그램 메시지 전송 실패", {
              response: response.data,
            });
          }
        } catch (err: any) {
          const status = err?.response?.status;
          const description = err?.response?.data?.description;
          const parameters = err?.response?.data?.parameters;
          logger?.error("❌ [Workflow] 텔레그램 전송 오류", {
            status,
            description,
            parameters,
          });

          // If it's an HTML parse error, retry once without parse_mode
          if (
            status === 400 &&
            typeof description === "string" &&
            description.toLowerCase().includes("parse")
          ) {
            try {
              const retry = await axios.post(
                `https://api.telegram.org/bot${botToken}/sendMessage`,
                {
                  chat_id: inputData.chatId,
                  text: message,
                },
                { timeout: 15000 },
              );
              if (retry.data?.ok) {
                lastMessageId = retry.data.result?.message_id;
                logger?.info("✅ [Workflow] 텔레그램 메시지 전송 성공(HTML 제거 후 재시도)");
                await new Promise((resolve) => setTimeout(resolve, 100));
                continue;
              }
            } catch (retryErr: any) {
              logger?.error("❌ [Workflow] 재시도 실패", {
                status: retryErr?.response?.status,
                description: retryErr?.response?.data?.description,
              });
            }
          }

          // For other errors (e.g., chat not found), stop loop and return failure
          throw err;
        }

        // Small delay between messages to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      
      return {
        sent: true,
        messageId: lastMessageId,
      };
      
    } catch (error) {
      logger?.error("❌ [Workflow] 텔레그램 전송 중 오류 발생:", { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return { sent: false };
    }
  }
});

export const telegramNewsletterWorkflow = createWorkflow({
  id: "telegram-newsletter-workflow",
  description: "텔레그램 한국어 코딩 뉴스레터 워크플로우",
  inputSchema: z.object({
    message: z.string(),
    threadId: z.string(),
    chatId: z.string(),
  }),
  outputSchema: z.object({
    sent: z.boolean(),
    messageId: z.number().optional(),
  })
})
  .then(useAgentStep)
  .then(sendTelegramMessageStep)
  .commit();
