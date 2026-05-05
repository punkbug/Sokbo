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
        // 2. 가치 평가 (Scoring - UI 표시용으로 유지)
        const { score, reasonTags } = scoreNews(news.title, "");
        const cleanTitle = news.title.replace(/<[^>]*>?/gm, "");

        // 3. '속보' 키워드 포함 여부 확인 (점수와 상관없이 수집)
        if (cleanTitle.includes("속보")) {
          const alreadySent = await isAlreadySent(news.link);
          if (!alreadySent) {
            // 4. DB 저장 (24시간 자동 만료 포함)
            const { error } = await supabase.from("news").insert([{
              title: cleanTitle,
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
                `[${preset} 속보]`,
                cleanTitle,
                news.link
              );
              results.push({ preset, title: cleanTitle, score });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, processed: results.length, details: results });
}
