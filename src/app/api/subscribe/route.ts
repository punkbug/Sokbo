import { NextResponse } from "next/server";
import { addSubscriber, removeSubscriber } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/push";

export async function POST(request: Request) {
  try {
    const { subscription, preset, action } = await request.json();

    if (!subscription || !preset) {
      return NextResponse.json({ error: "Missing subscription or preset" }, { status: 400 });
    }

    if (action === "subscribe") {
      await addSubscriber(preset, subscription);
    } else if (action === "unsubscribe") {
      await removeSubscriber(preset, subscription);
    } else if (action === "test-send") {
      // 해당 구독 객체로 즉시 테스트 발송
      await sendPushNotification(
        [subscription],
        "[테스트 알림]",
        "Sokbo 앱의 푸시 시스템이 정상적으로 작동 중입니다.",
        "https://sokbo.vercel.app"
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Subscription error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
