"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Info, Zap } from "lucide-react";
import clsx from "clsx";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Home() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [recentNews, setRecentNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsStandalone(Boolean((window.navigator as any).standalone));

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscription(sub);
        if (!sub && Notification.permission === "granted") {
          subscribeUser(reg);
        }
      });
    }

    const fetchNews = async () => {
      const res = await fetch("/api/news");
      if (res.ok) setRecentNews(await res.json());
    };
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  const subscribeUser = async (reg: ServiceWorkerRegistration) => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    try {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      
      // 서버에 구독 정보 저장 (컨셉 변경에 따라 단일 채널 구독)
      await fetch("/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription: sub, preset: "all", action: "subscribe" }),
        headers: { "Content-Type": "application/json" },
      });
      
      setSubscription(sub);
    } catch (e) {
      console.error("Subscription failed", e);
    }
  };

  const unsubscribeUser = async () => {
    if (!subscription) return;
    setLoading(true);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription, preset: "all", action: "unsubscribe" }),
        headers: { "Content-Type": "application/json" },
      });
      await subscription.unsubscribe();
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        await subscribeUser(reg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="absolute right-[-3rem] top-20 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
        <header className="sticky top-0 z-20 -mx-4 mb-6 px-4 py-4 sm:-mx-6 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-chip flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_16px_40px_rgba(37,99,235,0.35)]">
                <Zap className="h-5 w-5 fill-cyan-300 text-cyan-300" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">Sokbo</h1>
            </div>
            <button
              onClick={subscription ? unsubscribeUser : requestPermission}
              disabled={loading}
              className={clsx(
                "flex min-w-[112px] items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold shadow-[0_10px_30px_rgba(2,6,23,0.25)] backdrop-blur-xl transition",
                subscription ? "text-white hover:bg-white/15" : "text-cyan-100 hover:bg-white/12",
                loading && "cursor-not-allowed opacity-60"
              )}
            >
              {subscription ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {subscription ? "알림 활성" : "알림 켜기"}
            </button>
          </div>
        </header>

        <section className="glass-panel mb-6 rounded-[34px] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-300/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-4">
            <h2 className="text-3xl font-black tracking-tight text-white">속보</h2>
            <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white backdrop-blur-xl shadow-[0_10px_28px_rgba(2,6,23,0.14)]">
              {recentNews.length}
            </div>
          </div>
        </section>

        {isIOS && !isStandalone && (
          <div className="mb-6 flex items-start gap-4 rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h4 className="text-sm font-bold text-white">iPhone 알림 설정 안내</h4>
              <p className="mt-1 text-xs leading-5 text-blue-100/75">
                공유 버튼에서 `홈 화면에 추가`를 해야 푸시 알림이 정상 동작합니다.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {recentNews.length > 0 ? (
            recentNews.map((news) => (
              <NewsCard key={news.url} news={news} />
            ))
          ) : (
            <EmptyState />
          )}
        </div>
      </main>

    </div>
  );
}

function NewsCard({ news }: { news: any }) {
  return (
    <a 
      href={news.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="news-link glass-card group block rounded-[30px] p-6 no-underline transition-all active:scale-[0.99] hover:-translate-y-1 hover:border-cyan-300/30 hover:shadow-[0_24px_65px_rgba(37,99,235,0.22)]"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,rgba(34,211,238,0.95)_0%,rgba(59,130,246,0.85)_100%)]" />
      <div className="pointer-events-none absolute right-4 top-4 h-20 w-20 rounded-full bg-cyan-300/10 blur-2xl" />
      <div className="relative flex items-center gap-1.5">
        <h3 className="min-w-0 flex-1 line-clamp-2 text-[1.35rem] font-extrabold leading-[1.42] tracking-tight transition-colors group-hover:text-white">
          {news.title}
        </h3>
        <span className="shrink-0 rounded-full border border-white/12 bg-white/8 px-2 py-0.5 text-[10px] font-bold text-blue-50/90 backdrop-blur-xl shadow-[0_10px_28px_rgba(2,6,23,0.14)]">
          {new Date(news.published_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="glass-panel rounded-[36px] py-28 text-center">
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-white/12 bg-white/8 animate-pulse shadow-[0_20px_40px_rgba(59,130,246,0.18)] backdrop-blur-xl">
        <Zap className="h-12 w-12 text-cyan-200" />
      </div>
      <h3 className="mb-3 text-2xl font-black tracking-tighter text-white">속보를 스캔 중입니다</h3>
      <p className="px-8 text-sm font-medium leading-relaxed text-blue-100/72 sm:px-16">
        네이버 뉴스를 실시간으로 분석하고 있습니다.<br />새로운 속보가 감지되면 즉시 배달해 드립니다.
      </p>
    </div>
  );
}
