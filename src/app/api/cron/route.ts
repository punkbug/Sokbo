import { NextResponse } from "next/server";
import { fetchNaverNews, filterSokbo } from "@/lib/naver";
import { isAlreadySent, markAsSent, getSubscribers } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";
import { PRESETS } from "@/lib/presets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const results = [];

  for (const [preset, keywords] of Object.entries(PRESETS)) {
    const subscribers = await getSubscribers(preset);
    if (subscribers.length === 0) continue;

    for (const keyword of keywords) {
      const rawNews = await fetchNaverNews(keyword);
      const sokboNews = filterSokbo(rawNews);

      for (const news of sokboNews) {
        const alreadySent = await isAlreadySent(news.link);
        if (!alreadySent) {
          await sendPushNotification(
            subscribers,
            `[${preset} 속보]`,
            news.title,
            news.link
          );
          await markAsSent(news.link, news.title);
          results.push({ preset, title: news.title });
        }
      }
    }
  }

  return NextResponse.json({ success: true, sent: results });
}
