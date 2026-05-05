import { NextResponse } from "next/server";
import { fetchNaverNews, filterSokbo } from "@/lib/naver";
import { isAlreadySent, markAsSent, getSubscribers } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";
import { PRESETS } from "@/lib/presets";

export const dynamic = "force-dynamic";

export async function GET() {
  const debugResults: any = {
    time: new Date().toISOString(),
    presets: {},
    errors: []
  };

  try {
    for (const [preset, keywords] of Object.entries(PRESETS)) {
      const subscribers = await getSubscribers(preset);
      debugResults.presets[preset] = {
        subscribersCount: subscribers.length,
        keywords: {}
      };

      for (const keyword of keywords) {
        const rawNews = await fetchNaverNews(keyword);
        const sokboNews = filterSokbo(rawNews);

        debugResults.presets[preset].keywords[keyword] = {
          totalFetched: rawNews.length,
          sokboFiltered: sokboNews.length,
          examples: sokboNews.map(n => n.title)
        };

        for (const news of sokboNews) {
          const alreadySent = await isAlreadySent(news.link);
          if (!alreadySent) {
            // 디버그 모드에서는 실제 발송 대신 기록만 시도하거나 성공 여부 체크
            debugResults.presets[preset].keywords[keyword].newSokboFound = news.title;
            // 실제 발송 테스트를 원하시면 아래 주석을 해제하세요.
            // await sendPushNotification(subscribers, `[DEBUG ${preset}]`, news.title, news.link);
          }
        }
      }
    }
  } catch (error: any) {
    debugResults.errors.push(error.message);
  }

  return NextResponse.json(debugResults);
}
