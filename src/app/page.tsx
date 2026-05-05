"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/presets";
import { Bell, BellOff, Settings, Info, Zap, LayoutDashboard, History, Filter } from "lucide-react";
import clsx from "clsx";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"feed" | "settings" | "history">("feed");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [recentNews, setRecentNews] = useState<any[]>([]);
  const [subscribedPresets, setSubscribedPresets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. 서비스 워커 및 구독 확인
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscription(sub);
      });
    }

    // 2. 최근 뉴스 (24시간 이내) 페칭
    const fetchNews = async () => {
      const res = await fetch("/api/news");
      if (res.ok) setRecentNews(await res.json());
    };
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  // ... (기존 requestPermission, togglePreset 로직 동일하게 유지)

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
          오늘 수집된 고가치 소식: <span className="font-bold text-blue-600">{recentNews.length}개</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto pb-20 md:pb-0">
        <header className="md:hidden flex justify-between items-center p-6 bg-white border-b sticky top-0 z-10">
          <h1 className="text-xl font-bold text-blue-600">Sokbo</h1>
          <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
        </header>

        <div className="p-6 max-w-4xl mx-auto w-full">
          {activeTab === "feed" && (
            <section className="space-y-6">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h2 className="text-2xl font-bold">인사이트 피드</h2>
                  <p className="text-slate-500 text-sm">최근 24시간 내 엄선된 소식입니다.</p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Fresh 10min</span>
                </div>
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
              <h2 className="text-2xl font-bold">무엇을 받을까요?</h2>
              {/* 카테고리 칩 선택 UI 등 설정 로직 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <p className="text-slate-500 mb-6">관심 있는 주제를 선택하면 해당 분야의 가치 있는 속보를 10분 내로 전해드립니다.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.keys(PRESETS).map((p) => (
                    <button key={p} className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 transition-all text-left">
                      <span className="block font-semibold">{p}</span>
                      <span className="text-[10px] text-slate-400">실시간 감지 중</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-20">
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
      className="group block bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
    >
      <div className="flex justify-between items-start mb-3">
        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase">{news.category}</span>
        <span className="text-[10px] text-slate-400 font-medium">
          {new Date(news.published_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2 leading-snug">
        {news.title}
      </h3>
      <div className="flex flex-wrap gap-2 mt-4">
        {news.reason_tags?.map((tag: string) => (
          <span key={tag} className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full font-medium italic">#{tag}</span>
        ))}
        <span className="ml-auto text-[10px] text-slate-300 font-bold">SCORE: {news.score}</span>
      </div>
    </a>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold transition-all",
        active ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({ icon: Icon, active, onClick }: any) {
  return (
    <button onClick={onClick} className={clsx("p-2 rounded-full", active ? "text-blue-600 bg-blue-50" : "text-slate-400")}>
      <Icon className="w-6 h-6" />
    </button>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
      <Zap className="w-12 h-12 text-slate-200 mx-auto mb-4" />
      <h3 className="text-slate-800 font-bold">새로운 인사이트 대기 중</h3>
      <p className="text-slate-400 text-sm px-10">설정한 관심사에 가치 있는 속보가 올라오면 즉시 전해드립니다.</p>
    </div>
  );
}
