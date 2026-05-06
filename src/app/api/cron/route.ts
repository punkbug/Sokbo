import { NextResponse } from "next/server";
import { stripHtml } from "@/lib/naver";
import { sendPushNotification } from "@/lib/push";
import { getServerSupabase, isAlreadySent, markAsSent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3시간으로 대폭 완화

  try {
    const supabase = getServerSupabase();
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is missing.");
    }

    // 1. 모든 구독자 가져오기
    const { data: subs, error: subsError } = await supabase
      .from("subscriptions")
      .select("subscription_json");
    if (subsError) {
      throw new Error(`Failed to load subscriptions: ${subsError.message}`);
    }
    const subscribers = (subs as Array<{ subscription_json: any }> | null)?.map(
      ({ subscription_json }) => subscription_json
    ) || [];

    // 2. 네이버 속보 수집 (결과 100개로 최대화)
    const response = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent("속보")}&display=100&sort=date`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Naver API request failed with ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const rawNews = data.items || [];

    const results = [];
    const dbErrors = [];

    for (const item of rawNews) {
      const pubDate = new Date(item.pubDate);
      const cleanTitle = stripHtml(item.title);
      
      // 필터: 3시간 이내 + 제목에 '속보' 포함
      if (pubDate >= threeHoursAgo && cleanTitle.includes("속보")) {
        
        // A. DB 저장 시도
        const { error: dbError } = await supabase.from("news").upsert([
          {
            title: cleanTitle,
            url: item.link,
            category: "속보",
            score: 100,
            reason_tags: ["실시간"],
            published_at: pubDate.toISOString(),
            expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          }
        ], { onConflict: 'url' });

        if (dbError) {
          dbErrors.push({ title: cleanTitle, error: dbError });
          continue;
        }

        // B. 푸시 발송
        const alreadyPushed = await isAlreadySent(item.link);
        if (!alreadyPushed) {
          await sendPushNotification(subscribers, "[속보]", cleanTitle, item.link);
          await markAsSent(item.link, cleanTitle);
          results.push({ title: cleanTitle, status: "pushed" });
        } else {
          results.push({ title: cleanTitle, status: "updated_in_db" });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      currentTime: now.toISOString(),
      rawCount: rawNews.length,
      processedCount: results.length,
      dbErrors: dbErrors.length > 0 ? dbErrors : undefined,
      details: results 
    });

  } catch (globalError: any) {
    console.error("Critical Cron Error:", globalError);
    return NextResponse.json({ success: false, error: globalError.message }, { status: 500 });
  }
}
