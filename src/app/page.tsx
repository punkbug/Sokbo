"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Settings, Info, Zap, ExternalLink, X } from "lucide-react";
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
  const [isTesting, setIsTesting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const testDirectPush = async () => {
    if (!subscription) return;
    setIsTesting(true);
    try {
      await fetch("/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription, preset: "테스트", action: "test-send" }),
        headers: { "Content-Type": "application/json" },
      });
      alert("테스트 푸시가 전송되었습니다.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        <header className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-200/80 bg-slate-100/90 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-200">
                <Zap className="h-5 w-5 fill-white text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">Live Breaking</p>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Sokbo</h1>
              </div>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
              aria-label="설정 열기"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Realtime Feed</p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">속보가 먼저 보이는 첫 화면</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                최근 24시간 내 수집된 속보를 시간순으로 바로 확인합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Live</p>
              <p className="text-lg font-black text-blue-600">{recentNews.length}</p>
            </div>
          </div>
        </section>

        {isIOS && !isStandalone && (
          <div className="mb-6 flex items-start gap-4 rounded-[28px] border border-amber-200 bg-amber-50 p-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">iPhone 알림 설정 안내</h4>
              <p className="mt-1 text-xs leading-5 text-amber-800/80">
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

      <SettingsSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        subscription={subscription}
        loading={loading}
        isTesting={isTesting}
        onToggleNotifications={subscription ? unsubscribeUser : requestPermission}
        onTestPush={testDirectPush}
      />
    </div>
  );
}

function NewsCard({ news }: { news: any }) {
  return (
    <a 
      href={news.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-sm transition-all active:scale-[0.99] hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-xl hover:shadow-slate-200/70"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{news.source || "Naver News"}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">
          {new Date(news.published_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <h3 className="mb-6 line-clamp-2 text-xl font-bold leading-[1.45] tracking-tight text-slate-800 transition-colors group-hover:text-blue-600">
        {news.title}
      </h3>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {news.reason_tags?.map((tag: string) => (
            <span key={tag} className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-md uppercase">#{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-1 text-blue-600 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
          <span className="text-[10px] font-black uppercase">Read Full</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[36px] border border-dashed border-slate-200 bg-white py-28 text-center">
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 animate-pulse">
        <Zap className="h-12 w-12 text-slate-200" />
      </div>
      <h3 className="mb-3 text-2xl font-black tracking-tighter text-slate-800">속보를 스캔 중입니다</h3>
      <p className="px-8 text-sm font-medium leading-relaxed text-slate-400 sm:px-16">
        네이버 뉴스를 실시간으로 분석하고 있습니다.<br />새로운 속보가 감지되면 즉시 배달해 드립니다.
      </p>
    </div>
  );
}

function SettingsSheet({
  isOpen,
  onClose,
  subscription,
  loading,
  isTesting,
  onToggleNotifications,
  onTestPush,
}: {
  isOpen: boolean;
  onClose: () => void;
  subscription: PushSubscription | null;
  loading: boolean;
  isTesting: boolean;
  onToggleNotifications: () => void;
  onTestPush: () => void;
}) {
  return (
    <div
      className={clsx(
        "fixed inset-0 z-30 transition",
        isOpen ? "pointer-events-auto bg-slate-950/30" : "pointer-events-none bg-transparent"
      )}
    >
      <div
        className={clsx(
          "absolute right-0 top-0 h-full w-full max-w-md transform bg-white p-5 shadow-2xl transition duration-200 sm:p-6",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Settings</p>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">알림 설정</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:text-slate-700"
            aria-label="설정 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className={clsx("flex h-11 w-11 items-center justify-center rounded-2xl", subscription ? "bg-blue-600 text-white" : "bg-white text-slate-400")}>
                {subscription ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{subscription ? "알림이 활성화되어 있습니다" : "알림이 꺼져 있습니다"}</p>
                <p className="text-xs text-slate-500">설정은 이 화면에서만 관리합니다.</p>
              </div>
            </div>
            <button
              onClick={onToggleNotifications}
              disabled={loading}
              className={clsx(
                "w-full rounded-2xl px-4 py-3 text-sm font-bold transition",
                subscription
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-blue-600 text-white hover:bg-blue-500",
                loading && "cursor-not-allowed opacity-60"
              )}
            >
              {subscription ? "알림 끄기" : "알림 켜기"}
            </button>
          </section>

          <section className="rounded-[28px] border border-slate-200 p-5">
            <p className="mb-1 text-sm font-bold text-slate-900">푸시 테스트</p>
            <p className="mb-4 text-xs leading-5 text-slate-500">
              구독이 활성화된 경우 현재 기기에서 테스트 푸시를 바로 확인합니다.
            </p>
            <button
              onClick={onTestPush}
              disabled={isTesting || !subscription}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap className={clsx("h-4 w-4", isTesting && "animate-pulse")} />
              테스트 푸시 보내기
            </button>
          </section>

          <section className="rounded-[28px] border border-slate-200 p-5">
            <p className="mb-1 text-sm font-bold text-slate-900">서비스 정보</p>
            <p className="text-xs leading-5 text-slate-500">
              Sokbo는 네이버 뉴스에서 속보 키워드를 수집해 최근 24시간 피드와 푸시 알림을 제공합니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
