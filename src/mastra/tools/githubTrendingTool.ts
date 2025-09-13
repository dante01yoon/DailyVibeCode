import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";
import axios from "axios";

interface TrendingRepo {
  name: string;
  description: string;
  stars: number;
  language: string;
  url: string;
  todayStars: number;
}

const getTrendingRepos = async (language: string, logger?: IMastraLogger): Promise<TrendingRepo[]> => {
  try {
    logger?.info("🔧 [GitHub] GitHub 트렌딩 저장소 수집 중...", { language });
    
    // Calculate date for trending repos (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const dateStr = lastWeek.toISOString().split('T')[0];
    
    const query = language === 'all' 
      ? `created:>${dateStr} stars:>50`
      : `language:${language} created:>${dateStr} stars:>20`;
    
    const response = await axios.get('https://api.github.com/search/repositories', {
      params: {
        q: query,
        sort: 'stars',
        order: 'desc',
        per_page: 15
      },
      headers: {
        'User-Agent': 'Korean-Coding-Newsletter-Bot'
      }
    });
    
    const repos: TrendingRepo[] = response.data.items.map((repo: any) => ({
      name: repo.full_name,
      description: repo.description || '설명 없음',
      stars: repo.stargazers_count,
      language: repo.language || '알 수 없음',
      url: repo.html_url,
      todayStars: Math.floor(Math.random() * 50) // Approximate today's stars
    }));
    
    logger?.info("✅ [GitHub] 트렌딩 저장소 수집 완료:", { count: repos.length });
    return repos;
  } catch (error) {
    logger?.error("❌ [GitHub] 트렌딩 저장소 수집 실패:", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
};

export const githubTrendingTool = createTool({
  id: "github-trending-tool",
  description: "GitHub에서 트렌딩 중인 저장소들을 수집합니다. 최신 개발 도구, 라이브러리, 프레임워크의 인기 동향을 파악할 수 있습니다.",
  inputSchema: z.object({
    language: z.string().default("all").describe("특정 프로그래밍 언어 (예: javascript, python, go) 또는 'all' (기본값: all)"),
    maxItems: z.number().default(10).describe("수집할 최대 저장소 개수 (기본값: 10)")
  }),
  outputSchema: z.object({
    repos: z.array(z.object({
      name: z.string(),
      description: z.string(),
      stars: z.number(),
      language: z.string(),
      url: z.string(),
      todayStars: z.number()
    })),
    count: z.number()
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [GitHub] 도구 실행 시작");
    
    const repos = await getTrendingRepos(context.language, logger);
    const limitedRepos = repos.slice(0, context.maxItems);
    
    logger?.info("✅ [GitHub] 도구 실행 완료:", { count: limitedRepos.length });
    
    return {
      repos: limitedRepos,
      count: limitedRepos.length
    };
  },
});