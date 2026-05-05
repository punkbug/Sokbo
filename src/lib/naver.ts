export interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

/**
 * HTML 태그를 제거하는 유틸리티 함수
 */
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>?/gm, "").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
};

/**
 * 네이버 뉴스 API를 통해 특정 키워드의 기사를 가져옴
 */
export const fetchNaverNews = async (query: string): Promise<NaverNewsItem[]> => {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Naver API credentials missing");
    return [];
  }

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(
        query
      )}&display=10&sort=date`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Naver API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error fetching Naver news:", error);
    return [];
  }
};

/**
 * 기사 목록에서 '속보'가 포함된 기사만 필터링
 */
export const filterSokbo = (items: NaverNewsItem[]): NewsItem[] => {
  return items
    .map((item) => ({
      title: stripHtml(item.title),
      link: item.link,
      pubDate: item.pubDate,
    }))
    .filter((item) => item.title.includes("속보"));
};
