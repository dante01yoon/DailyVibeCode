import { createTool } from "@mastra/core/tools";
import type { IMastraLogger } from "@mastra/core/logger";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

interface HackerNewsItem {
  title: string;
  url: string;
  score: number;
  comments: number;
}

const getHackerNewsStories = async (logger?: IMastraLogger): Promise<HackerNewsItem[]> => {
  try {
    logger?.info("🔧 [HackerNews] 해커뉴스에서 최신 기술 뉴스 수집 중...");
    
    // Get top stories from Hacker News API
    const topStoriesResponse = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topStoryIds = topStoriesResponse.data.slice(0, 20); // Get top 20 stories

    const stories: HackerNewsItem[] = [];
    
    for (const storyId of topStoryIds.slice(0, 10)) { // Limit to 10 for performance
      try {
        const storyResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
        const story = storyResponse.data;
        
        // Filter for tech-related content
        const techKeywords = ['AI', 'ML', 'JavaScript', 'Python', 'React', 'Node', 'framework', 'library', 'tool', 'API', 'database', 'cloud', 'DevOps', 'Git', 'GitHub', 'open source'];
        const isTechRelated = techKeywords.some(keyword => 
          story.title?.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (story.title && story.url && isTechRelated) {
          stories.push({
            title: story.title,
            url: story.url,
            score: story.score || 0,
            comments: story.descendants || 0
          });
        }
      } catch (error) {
        logger?.warn("🔧 [HackerNews] 스토리 처리 중 오류:", { storyId, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    logger?.info("✅ [HackerNews] 수집 완료:", { count: stories.length });
    return stories;
  } catch (error) {
    logger?.error("❌ [HackerNews] 뉴스 수집 실패:", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
};

export const hackerNewsTool = createTool({
  id: "hacker-news-tool",
  description: "해커뉴스에서 최신 기술 뉴스와 개발 도구 정보를 수집합니다. 인기 있는 개발 관련 포스트들을 가져와서 한국어 뉴스레터 작성에 활용할 수 있습니다.",
  inputSchema: z.object({
    maxItems: z.number().default(10).describe("수집할 최대 뉴스 개수 (기본값: 10)")
  }),
  outputSchema: z.object({
    stories: z.array(z.object({
      title: z.string(),
      url: z.string(),
      score: z.number(),
      comments: z.number()
    })),
    count: z.number()
  }),
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔧 [HackerNews] 도구 실행 시작");
    
    const stories = await getHackerNewsStories(logger);
    const limitedStories = stories.slice(0, context.maxItems);
    
    logger?.info("✅ [HackerNews] 도구 실행 완료:", { count: limitedStories.length });
    
    return {
      stories: limitedStories,
      count: limitedStories.length
    };
  },
});