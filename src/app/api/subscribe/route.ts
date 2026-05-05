import { NextResponse } from "next/server";
import { addSubscriber, removeSubscriber } from "@/lib/supabase";

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
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
