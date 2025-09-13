import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

interface DevTip {
  title: string;
  content: string;
  source: string;
  category: string;
}

const getDevTips = async (logger?: IMastraLogger): Promise<DevTip[]> => {
  try {
    logger?.info("🔧 [DevTips] 개발 팁과 방법론 수집 중...");
    
    const tips: DevTip[] = [];
    
    // Add some curated dev tips and best practices
    const curatedTips: DevTip[] = [
      {
        title: "Git 커밋 메시지 작성 가이드",
        content: "좋은 커밋 메시지는 다음과 같은 형식을 따릅니다: feat: 새로운 기능, fix: 버그 수정, docs: 문서 변경, style: 코드 포맷팅, refactor: 코드 리팩토링, test: 테스트 추가 또는 수정",
        source: "Git Best Practices",
        category: "Version Control"
      },
      {
        title: "React 성능 최적화 팁",
        content: "React.memo()를 사용하여 불필요한 리렌더링을 방지하고, useMemo와 useCallback 훅을 활용하여 연산 비용이 높은 작업을 최적화하세요. 또한 코드 스플리팅을 통해 초기 로딩 시간을 단축할 수 있습니다.",
        source: "React Performance Guide",
        category: "Frontend"
      },
      {
        title: "API 설계 베스트 프랙티스",
        content: "RESTful API 설계 시 명확한 URL 구조를 사용하고, HTTP 메서드를 올바르게 활용하며, 적절한 상태 코드를 반환하세요. 또한 API 버저닝과 속도 제한(Rate Limiting)을 구현하는 것이 중요합니다.",
        source: "API Design Guidelines",
        category: "Backend"
      },
      {
        title: "테스트 주도 개발 (TDD) 접근법",
        content: "Red-Green-Refactor 사이클을 따르세요: 1) 실패하는 테스트를 작성하고, 2) 테스트를 통과하는 최소한의 코드를 작성한 후, 3) 코드를 리팩토링합니다. 이를 통해 더 안정적이고 유지보수하기 쉬운 코드를 작성할 수 있습니다.",
        source: "TDD Methodology",
        category: "Testing"
      },
      {
        title: "Docker 컨테이너 최적화",
        content: "멀티 스테이지 빌드를 사용하여 이미지 크기를 줄이고, .dockerignore 파일로 불필요한 파일을 제외하며, 레이어 캐싱을 활용하세요. 또한 non-root 유저로 실행하여 보안을 강화하는 것이 좋습니다.",
        source: "Docker Best Practices",
        category: "DevOps"
      },
      {
        title: "코드 리뷰 효과적으로 하기",
        content: "코드 리뷰 시 기능 동작, 코드 스타일, 성능, 보안을 체크하세요. 건설적인 피드백을 제공하고, 작은 단위로 자주 리뷰하며, 자동화된 도구(린터, 포매터)를 활용하여 효율성을 높이세요.",
        source: "Code Review Guidelines",
        category: "Collaboration"
      }
    ];
    
    tips.push(...curatedTips);
    
    // Shuffle tips to provide variety
    for (let i = tips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tips[i], tips[j]] = [tips[j], tips[i]];
    }
    
    logger?.info("✅ [DevTips] 개발 팁 수집 완료:", { count: tips.length });
    return tips;
  } catch (error) {
    logger?.error("❌ [DevTips] 개발 팁 수집 실패:", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
};

export const devTipsTool = createTool({
  id: "dev-tips-tool",
  description: "개발자를 위한 실용적인 팁, 베스트 프랙티스, 방법론을 제공합니다. 코딩 스타일, 성능 최적화, 협업 방법 등 다양한 개발 관련 조언을 수집합니다.",
  inputSchema: z.object({
    category: z.string().default("all").describe("특정 카테고리 (Frontend, Backend, DevOps, Testing, Collaboration) 또는 'all' (기본값: all)"),
    maxTips: z.number().default(5).describe("수집할 최대 팁 개수 (기본값: 5)")
  }),
  outputSchema: z.object({
    tips: z.array(z.object({
      title: z.string(),
      content: z.string(),
      source: z.string(),
      category: z.string()
    })),
    count: z.number()
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [DevTips] 도구 실행 시작");
    
    let tips = await getDevTips(logger);
    
    // Filter by category if specified
    if (context.category && context.category !== 'all') {
      tips = tips.filter(tip => 
        tip.category.toLowerCase().includes(context.category.toLowerCase())
      );
    }
    
    const limitedTips = tips.slice(0, context.maxTips);
    
    logger?.info("✅ [DevTips] 도구 실행 완료:", { count: limitedTips.length });
    
    return {
      tips: limitedTips,
      count: limitedTips.length
    };
  },
});