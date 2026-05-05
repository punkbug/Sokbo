import { NextResponse } from "next/server";
import { fetchNaverNews } from "@/lib/naver";
import { isAlreadySent, getSubscribers, supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";
import { PRESETS } from "@/lib/presets";
import { scoreNews } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = [];
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  for (const [preset, keywords] of Object.entries(PRESETS)) {
    const subscribers = await getSubscribers(preset);
    if (subscribers.length === 0) continue;

    for (const keyword of keywords) {
      const rawNews = await fetchNaverNews(keyword);
      
      // 1. 10분 이내 신선한 뉴스만 필터링
      const freshNews = rawNews.filter(n => new Date(n.pubDate) >= tenMinutesAgo);

      for (const news of freshNews) {
        // 2. 가치 평가 (Scoring)
        const { score, reasonTags } = scoreNews(news.title, ""); // 네이버 API는 source를 따로 안주므로 제목에서 추출하거나 생략

        // 3. 임계치(150점) 및 중복 확인
        if (score >= 150) {
          const alreadySent = await isAlreadySent(news.link);
          if (!alreadySent) {
            // 4. DB 저장 (24시간 자동 만료 포함)
            const { error } = await supabase.from("news").insert([{
              title: news.title.replace(/<[^>]*>?/gm, ""),
              url: news.link,
              category: preset,
              score,
              reason_tags: reasonTags,
              published_at: news.pubDate,
              expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
            }]);

            if (!error) {
              // 5. 푸시 발송
              await sendPushNotification(
                subscribers,
                `[${preset} 중요]`,
                news.title.replace(/<[^>]*>?/gm, ""),
                news.link
              );
              results.push({ preset, title: news.title, score });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, processed: results.length, details: results });
}
