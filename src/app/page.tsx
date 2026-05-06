"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Settings, Info, Zap, LayoutDashboard, History, Filter, ExternalLink } from "lucide-react";
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
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar (Desktop/Tablet) */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 p-6 space-y-8">
        <h1 className="text-2xl font-bold text-blue-600 tracking-tight flex items-center gap-2">
          <Zap className="w-6 h-6 fill-blue-600" /> Sokbo
        </h1>
        <div className="flex-1">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Notification</h3>
            <button
              onClick={subscription ? unsubscribeUser : requestPermission}
              disabled={loading}
              className={clsx(
                "w-full py-4 rounded-2xl font-bold transition-all flex flex-col items-center gap-2",
                subscription 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                  : "bg-white border-2 border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-500"
              )}
            >
              {subscription ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
              <span className="text-sm">{subscription ? "알림 활성화됨" : "알림 켜기"}</span>
            </button>
          </div>
          
          <button 
            onClick={testDirectPush}
            disabled={isTesting || !subscription}
            className="w-full py-3 rounded-xl text-xs font-bold text-slate-400 border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-3 h-3" /> 푸시 테스트
          </button>
        </div>
        <div className="text-[10px] text-slate-300 font-bold text-center">
          © 2026 SOKBO PROJECT<br/>ALL NEWS FROM NAVER
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto pb-20 md:pb-0">
        <header className="md:hidden flex justify-between items-center p-6 bg-white border-b sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 fill-blue-600 text-blue-600" />
            <h1 className="text-xl font-black text-blue-600 tracking-tighter">SOKBO</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={testDirectPush}
              disabled={isTesting || !subscription}
              className={clsx("p-2 rounded-xl transition-all", subscription ? "text-amber-500 bg-amber-50" : "text-slate-200 bg-slate-50")}
            >
              <Zap className={clsx("w-5 h-5", isTesting && "animate-pulse")} />
            </button>
            <button 
              onClick={subscription ? unsubscribeUser : requestPermission}
              className={clsx("p-2 rounded-xl transition-all", subscription ? "text-blue-600 bg-blue-50" : "text-slate-300 bg-slate-100")}
            >
              {subscription ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="p-6 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">인사이트 피드</h2>
              <p className="text-slate-400 text-sm font-medium">최근 24시간 내 발생한 모든 속보입니다.</p>
            </div>
            <div className="hidden sm:flex gap-2">
              <span className="bg-blue-600 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter shadow-lg shadow-blue-100">Live 10m</span>
            </div>
          </div>

          {isIOS && !(window.navigator as any).standalone && (
            <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 mb-8 flex gap-4 items-start animate-in slide-in-from-top-4 duration-500">
              <Info className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-800 text-sm mb-1">iPhone 알림 설정 안내</h4>
                <p className="text-xs text-amber-700/80 leading-relaxed">
                  하단 <strong>'공유 버튼'</strong>을 누르고 <strong>'홈 화면에 추가'</strong>를 하셔야 정상적으로 알림을 받으실 수 있습니다.
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
          
          <div className="mt-12 py-10 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-200 uppercase tracking-[0.2em]">End of Feed</p>
          </div>
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
      className="group block bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all active:scale-[0.98] relative overflow-hidden"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{news.source || "Naver News"}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">
          {new Date(news.published_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-6 line-clamp-2 leading-[1.4] tracking-tight">
        {news.title}
      </h3>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
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
    <div className="text-center py-32 bg-white rounded-[40px] border border-dashed border-slate-200">
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
        <Zap className="w-12 h-12 text-slate-200" />
      </div>
      <h3 className="text-slate-800 font-black text-2xl mb-3 tracking-tighter">인사이트 스캔 중</h3>
      <p className="text-slate-400 text-sm px-16 leading-relaxed font-medium">
        네이버 뉴스를 실시간으로 분석하고 있습니다.<br />새로운 속보가 감지되면 즉시 배달해 드립니다.
      </p>
    </div>
  );
}
