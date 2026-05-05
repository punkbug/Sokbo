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
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  // 통합 구독자 가져오기 (카테고리 구분 없음)
  const { data: subs, error } = await supabase.from("subscriptions").select("subscription_json");
  if (error || !subs || subs.length === 0) return NextResponse.json({ success: true, message: "No subscribers" });
  const subscribers = subs.map(s => s.subscription_json);

  // 전체 속보 수집
  const rawNews = await fetchNaverNews("속보");
  const freshNews = rawNews.filter(n => new Date(n.pubDate) >= tenMinutesAgo && n.title.includes("속보"));

  for (const news of freshNews) {
    const cleanTitle = news.title.replace(/<[^>]*>?/gm, "");
    const alreadySent = await isAlreadySent(news.link);
    
    if (!alreadySent) {
      await supabase.from("news").insert([{
        title: cleanTitle,
        url: news.link,
        category: "속보",
        published_at: news.pubDate,
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      }]);

      await sendPushNotification(subscribers, "[속보]", cleanTitle, news.link);
      await markAsSent(news.link, cleanTitle);
      results.push({ title: cleanTitle });
    }
  }

  return NextResponse.json({ success: true, sent: results });
}
