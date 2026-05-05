"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/presets";
import { Bell, BellOff, Settings, Info, Zap, LayoutDashboard, History, Filter } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"feed" | "settings" | "history">("feed");
  const [isIOS, setIsIOS] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [subscribedPresets, setSubscribedPresets] = useState<string[]>([]);
  const [recentNews, setRecentNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscription(sub);
        if (!sub && Notification.permission === "granted") {
          subscribeUser(reg);
        }
      });
    }

    const saved = localStorage.getItem("subscribedPresets");
    if (saved) setSubscribedPresets(JSON.parse(saved));

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
      setSubscription(sub);
    } catch (e) {
      console.error("Subscription failed", e);
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

  const togglePreset = async (preset: string) => {
    if (!subscription) {
      alert("먼저 알림 권한을 허용해주세요.");
      return;
    }
    const isSubscribed = subscribedPresets.includes(preset);
    const action = isSubscribed ? "unsubscribe" : "subscribe";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription, preset, action }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const newPresets = isSubscribed
          ? subscribedPresets.filter((p) => p !== preset)
          : [...subscribedPresets, preset];
        setSubscribedPresets(newPresets);
        localStorage.setItem("subscribedPresets", JSON.stringify(newPresets));
      }
    } catch (e) {
      console.error(e);
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar (Desktop/Tablet) */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 p-6 space-y-8">
        <h1 className="text-2xl font-bold text-blue-600 tracking-tight">Sokbo 2.0</h1>
        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label="인사이트 피드" active={activeTab === "feed"} onClick={() => setActiveTab("feed")} />
          <NavItem icon={History} label="발송 이력" active={activeTab === "history"} onClick={() => setActiveTab("history")} />
          <NavItem icon={Settings} label="알림 설정" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </nav>
        <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500">
          오늘 엄선된 소식: <span className="font-bold text-blue-600">{recentNews.length}개</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto pb-20 md:pb-0">
        <header className="md:hidden flex justify-between items-center p-6 bg-white border-b sticky top-0 z-10">
          <h1 className="text-xl font-bold text-blue-600">Sokbo</h1>
          <button onClick={testDirectPush} disabled={isTesting || !subscription}>
            <Zap className={clsx("w-5 h-5", isTesting ? "animate-pulse text-amber-500" : "text-slate-400")} />
          </button>
        </header>

        <div className="p-6 max-w-4xl mx-auto w-full">
          {activeTab === "feed" && (
            <section className="space-y-6">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-2xl font-bold">인사이트 피드</h2>
                  <p className="text-slate-500 text-sm">최근 24시간 내 엄선된 소식입니다.</p>
                </div>
                {!subscription && (
                  <button onClick={requestPermission} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-full font-bold shadow-md hover:bg-blue-700 transition-all">
                    알림 켜기
                  </button>
                )}
              </div>

              <div className="grid gap-4">
                {recentNews.length > 0 ? (
                  recentNews.map((news) => (
                    <NewsCard key={news.url} news={news} />
                  ))
                ) : (
                  <EmptyState />
                )}
              </div>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold mb-2">무엇을 받을까요?</h2>
                <p className="text-slate-500 text-sm">관심 있는 주제를 선택하면 고품질 속보를 10분 내로 전해드립니다.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.keys(PRESETS).map((p) => (
                  <button 
                    key={p} 
                    onClick={() => togglePreset(p)}
                    className={clsx(
                      "p-4 rounded-2xl border transition-all text-left group relative overflow-hidden",
                      subscribedPresets.includes(p) ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <span className={clsx("block font-bold mb-1", subscribedPresets.includes(p) ? "text-blue-700" : "text-slate-700")}>{p}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {subscribedPresets.includes(p) ? "실시간 수신 중" : "알림 받기"}
                    </span>
                    {subscribedPresets.includes(p) && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-ping" />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === "history" && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">발송 이력</h2>
              <p className="text-slate-500 text-sm">최근 발송된 모든 소식의 타임라인입니다.</p>
              <div className="space-y-3 opacity-60">
                {recentNews.map((news) => (
                  <div key={news.url + "_h"} className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 w-16">{new Date(news.published_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <p className="text-sm font-medium text-slate-600 truncate flex-1">{news.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 flex justify-around p-3 z-20">
        <MobileNavItem icon={LayoutDashboard} active={activeTab === "feed"} onClick={() => setActiveTab("feed")} />
        <MobileNavItem icon={History} active={activeTab === "history"} onClick={() => setActiveTab("history")} />
        <MobileNavItem icon={Settings} active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
      </nav>
    </div>
  );
}

function NewsCard({ news }: { news: any }) {
  return (
    <a 
      href={news.url} 
      target="_blank" 
      className="group block bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99] relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-3">
        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-tight">{news.category}</span>
        <span className="text-[10px] text-slate-400 font-medium">
          {new Date(news.published_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-4 line-clamp-2 leading-snug">
        {news.title}
      </h3>
      <div className="flex flex-wrap gap-2 items-center">
        {news.reason_tags?.map((tag: string) => (
          <span key={tag} className="text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded-md font-bold tracking-tight">#{tag}</span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (news.score / 200) * 100)}%` }} />
          </div>
          <span className="text-[9px] text-slate-300 font-black">VAL {news.score}</span>
        </div>
      </div>
    </a>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold transition-all",
        active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({ icon: Icon, active, onClick }: any) {
  return (
    <button onClick={onClick} className={clsx("p-2 rounded-2xl transition-all", active ? "text-blue-600 bg-blue-50 px-6" : "text-slate-300")}>
      <Icon className="w-6 h-6" />
    </button>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24 bg-white rounded-[32px] border border-dashed border-slate-200">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <Zap className="w-10 h-10 text-slate-200" />
      </div>
      <h3 className="text-slate-800 font-black text-xl mb-2 tracking-tight">인사이트 스캔 중</h3>
      <p className="text-slate-400 text-sm px-12 leading-relaxed">
        선택한 관심사에 가치 있는 소식이 감지되면<br />10분 내로 이곳에 배달됩니다.
      </p>
    </div>
  );
}
