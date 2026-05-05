import { stripHtml } from "./naver";

const HIGH_VALUE_KEYWORDS = ["금리", "대통령", "재난", "비상", "계엄", "발표", "합의", "독점", "단독"];
const CLICKBAIT_KEYWORDS = ["경악", "충격", "결국", "안타까운", "이럴수가", "속보만 반복"];
const MAJOR_SOURCES = ["연합뉴스", "뉴시스", "뉴스1", "매일경제", "한국경제", "KBS", "MBC", "SBS"];

export interface ScoredNews {
  score: number;
  reasonTags: string[];
}

export const scoreNews = (title: string, source: string): ScoredNews => {
  let score = 100; // 기본 점수
  const reasonTags: string[] = [];
  const cleanTitle = stripHtml(title);

  // 1. 키워드 가점
  if (cleanTitle.includes("속보")) {
    score += 30;
    reasonTags.push("실시간 속보");
  }
  
  HIGH_VALUE_KEYWORDS.forEach(kw => {
    if (cleanTitle.includes(kw)) {
      score += 40;
      reasonTags.push("핵심 키워드");
    }
  });

  // 2. 언론사 가점
  if (MAJOR_SOURCES.some(ms => source.includes(kw => ms))) {
    score += 20;
    reasonTags.push("주요 언론사");
  }

  // 3. 낚시성 감점
  CLICKBAIT_KEYWORDS.forEach(kw => {
    if (cleanTitle.includes(kw)) {
      score -= 50;
    }
  });

  return { score, reasonTags: Array.from(new Set(reasonTags)) };
};
