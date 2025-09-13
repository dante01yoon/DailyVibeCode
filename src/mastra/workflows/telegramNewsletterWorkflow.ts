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
    
    // Generate newsletter using the agent (ONLY agent logic)
    const { text } = await koreanNewsletterAgent.generate([
      { 
        role: "user", 
        content: "안녕하세요! 오늘의 코딩 뉴스레터를 작성해주세요. 최신 기술 뉴스, 트렌딩 저장소, 그리고 유용한 개발 팁들을 포함하여 흥미롭고 유용한 내용으로 구성해주세요."
      }
    ], {
      resourceId: "bot",
      threadId: inputData.threadId,
      maxSteps: 5, // Allow multiple tool calls
    });
    
    logger?.info("✅ [Workflow] 뉴스레터 생성 완료");
    
    return {
      response: text,
      chatId: inputData.chatId,
    };
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
      
      // Send each message chunk
      for (const message of messages) {
        const response = await axios.post(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            chat_id: inputData.chatId,
            text: message,
            parse_mode: "HTML",
          }
        );
        
        if (response.data.ok) {
          lastMessageId = response.data.result.message_id;
          logger?.info("✅ [Workflow] 텔레그램 메시지 전송 성공");
        } else {
          logger?.error("❌ [Workflow] 텔레그램 메시지 전송 실패", { error: response.data });
        }
        
        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
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