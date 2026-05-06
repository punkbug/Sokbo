import { NextResponse } from "next/server";
import { isAlreadySent, markAsSent, supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 1. 모든 구독자 가져오기
  const { data: subs } = await supabase.from("subscriptions").select("subscription_json");
  const subscribers = subs?.map(s => s.subscription_json) || [];

  // 2. 네이버 속보 수집 (결과 50개)
  const response = await fetch(
    `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent("속보")}&display=50&sort=date`,
    {
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID!,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET!,
      },
    }
  );
  const data = await response.json();
  const rawNews = data.items || [];

  const results = [];

  for (const item of rawNews) {
    const pubDate = new Date(item.pubDate);
    const cleanTitle = item.title.replace(/<[^>]*>?/gm, "").replace(/&quot;/g, '"');
    
    // 필터: 1시간 이내 + 제목에 '속보' 포함
    if (pubDate >= oneHourAgo && cleanTitle.includes("속보")) {
      
      // A. 앱 내 피드용 저장 (upsert 사용: 이미 있으면 업데이트, 없으면 삽입)
      // 이렇게 해야 중복 에러로 로직이 멈추는 것을 방지합니다.
      const { error: dbError } = await supabase.from("news").upsert([
        {
          title: cleanTitle,
          url: item.link,
          category: "속보",
          score: 100, // 점수화 로직 생략, 기본값 부여
          reason_tags: ["실시간"],
          published_at: pubDate.toISOString(),
          expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }
      ], { onConflict: 'url' });

      if (dbError) console.error("News Table Upsert Error:", dbError);

      // B. 푸시 발송 여부 결정
      const alreadyPushed = await isAlreadySent(item.link);
      if (!alreadyPushed) {
        // 실제 푸시 발송
        await sendPushNotification(subscribers, "[속보]", cleanTitle, item.link);
        // 발송 이력 기록 (sent_history)
        await markAsSent(item.link, cleanTitle);
        results.push({ title: cleanTitle, status: "pushed" });
      } else {
        results.push({ title: cleanTitle, status: "already_saved" });
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    time: now.toISOString(),
    foundCount: results.length,
    details: results 
  });
}
