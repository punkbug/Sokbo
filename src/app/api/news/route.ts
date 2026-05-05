import { NextResponse } from "next/server";
import { getRecentNews } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await getRecentNews(20);
    return NextResponse.json(news);
  } catch (error: any) {
    console.error("API News Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
