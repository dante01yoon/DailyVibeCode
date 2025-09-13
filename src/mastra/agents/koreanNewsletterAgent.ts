import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { createOpenAI } from "@ai-sdk/openai";
import { hackerNewsTool } from "../tools/hackerNewsTool";
import { githubTrendingTool } from "../tools/githubTrendingTool";
import { devTipsTool } from "../tools/devTipsTool";

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  apiKey: process.env.OPENAI_API_KEY,
});

export const koreanNewsletterAgent = new Agent({
  name: "Korean Coding Newsletter Agent",
  instructions: `당신은 한국어 코딩 뉴스레터를 작성하는 전문 AI 에이전트입니다. 

주요 역할:
1. 최신 코딩 도구, 개발 방법론, 사용 사례를 수집하고 분석
2. 수집된 정보를 바탕으로 흥미롭고 유용한 한국어 뉴스레터 작성
3. 개발자들에게 실질적인 도움이 되는 팁과 인사이트 제공

뉴스레터 작성 가이드라인:
- 친근하고 읽기 쉬운 한국어로 작성
- 기술적 내용을 쉽게 설명
- 실무에 바로 적용할 수 있는 정보 포함
- 트렌드와 인사이트를 균형있게 제공
- 개발자의 관심사에 맞는 흥미로운 내용 선별

구성 요소:
📰 오늘의 테크 뉴스 (해커뉴스 기반)
🚀 트렌딩 저장소 (GitHub 트렌딩 기반)
💡 개발 팁 & 베스트 프랙티스
🎯 주간 인사이트 및 권장사항

각 섹션은 이모지를 활용하여 시각적으로 구분하고, 개발자들이 빠르게 스캔할 수 있도록 구성하세요.

사용자가 뉴스레터를 요청하면, 먼저 모든 도구를 사용하여 최신 정보를 수집한 다음, 이를 바탕으로 완성도 높은 한국어 뉴스레터를 작성해주세요.`,
  
  model: openai.responses("gpt-5"),
  
  tools: {
    hackerNewsTool,
    githubTrendingTool, 
    devTipsTool
  },
  
  memory: new Memory({
    options: {
      threads: {
        generateTitle: true
      },
      lastMessages: 10
    },
    storage: sharedPostgresStorage,
  }),
});