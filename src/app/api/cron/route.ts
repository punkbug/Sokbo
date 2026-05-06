import { NextResponse } from "next/server";
import { fetchNaverNews } from "@/lib/naver";
import { isAlreadySent, markAsSent, supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results = [];
  const now = new Date();
  const rangeMinutes = 20; // 10분에서 20분으로 범위를 넓혀 안정성 확보
  const timeRangeAgo = new Date(now.getTime() - rangeMinutes * 60 * 1000);

  console.log(`Cron started at ${now.toISOString()}. Searching news from ${timeRangeAgo.toISOString()}`);

  // 1. 모든 구독자 가져오기
  const { data: subs, error: subsError } = await supabase.from("subscriptions").select("subscription_json");
  if (subsError) console.error("DB Error (getSubscribers):", subsError);
  const subscribers = subs?.map(s => s.subscription_json) || [];

  // 2. 전체 속보 수집 (결과 개수를 50개로 늘려 누락 방지)
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

  // 검색 API 지연을 고려하여 시간 필터를 1시간으로 완화하되, 중복 체크(isAlreadySent)로 실시간성 유지
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const freshNews = rawNews.filter((n: any) => {
    const pubDate = new Date(n.pubDate);
    const hasSokbo = n.title.includes("속보");
    return pubDate >= oneHourAgo && hasSokbo;
  });

  console.log(`Found ${freshNews.length} fresh '속보' articles`);

  for (const news of freshNews) {
    const cleanTitle = news.title.replace(/<[^>]*>?/gm, "").replace(/&quot;/g, '"');
    const alreadySent = await isAlreadySent(news.link);
    
    // 3. DB 저장 시도
    const { error: insertError } = await supabase.from("news").insert([{
      title: cleanTitle,
      url: news.link,
      category: "속보",
      published_at: news.pubDate,
      expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    }]);

    if (insertError) {
      if (insertError.code !== "23505") { // 중복 키 에러 제외
        console.error("DB Error (news insert):", insertError);
      }
    } else {
      console.log(`New article saved: ${cleanTitle}`);
      // 4. 새로운 기사만 푸시 발송
      if (!alreadySent) {
        await sendPushNotification(subscribers, "[속보]", cleanTitle, news.link);
        await markAsSent(news.link, cleanTitle);
        results.push({ title: cleanTitle, pushed: true });
      }
    }
  }

  return NextResponse.json({ success: true, processed: results });
}
