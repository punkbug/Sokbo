"use client";

import { useEffect, useState } from "react";
import { PRESETS } from "@/lib/presets";
import { Bell, BellOff, Settings, Info, Zap } from "lucide-react";

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
  const [permissionState, setPermissionState] = useState<NotificationPermission | "default">("default");
  const [subscribedPresets, setSubscribedPresets] = useState<string[]>([]);
  const [recentNews, setRecentNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setPermissionState(Notification.permission);

    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscription(sub);
        
        // 이미 권한은 있는데 구독이 없는 경우 자동 구독 시도
        if (!sub && Notification.permission === "granted") {
          subscribeUser(reg);
        }
      });
    }

    const saved = localStorage.getItem("subscribedPresets");
    if (saved) setSubscribedPresets(JSON.parse(saved));

    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news");
        if (res.ok) setRecentNews(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, []);

  const subscribeUser = async (reg: ServiceWorkerRegistration) => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    console.log("Attempting to subscribe with VAPID Key:", vapidKey);
    
    if (!vapidKey) {
      console.error("VAPID Public Key is missing in process.env");
      return;
    }

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
      setPermissionState(permission);
      
      if (permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        await subscribeUser(reg);
      } else {
        alert("알림 권한이 거부되었습니다. 브라우저 설정에서 알림을 허용해주세요.");
      }
    } catch (error) {
      console.error("Permission request failed", error);
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
    } catch (error) {
      console.error("Toggle preset failed", error);
    }
  };

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-blue-600 tracking-tight">Sokbo</h1>
        <button className="p-2 bg-white rounded-full shadow-sm">
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </header>

      {isIOS && !(window.navigator as any).standalone && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>iPhone 사용자님:</strong> 하단 <span className="font-bold underline">공유 버튼</span>을 누르고 <span className="font-bold underline">'홈 화면에 추가'</span>를 하셔야 알림을 받으실 수 있습니다.
            </p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">알림 설정</h2>
            <p className="text-sm text-gray-500">관심사 속보를 실시간으로 받아보세요.</p>
          </div>
          <button
            onClick={requestPermission}
            disabled={!!subscription || loading}
            className={`p-3 rounded-full transition-colors ${
              subscription ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
            }`}
          >
            {subscription ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
          </button>
        </div>
      </section>

      <section className="flex-1 mb-8">
        <h3 className="text-sm font-medium text-gray-400 mb-4 px-1 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> 실시간 속보 피드
        </h3>
        <div className="space-y-3">
          {recentNews.length > 0 ? (
            recentNews.map((news) => (
              <a
                key={news.link}
                href={news.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white p-4 rounded-xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform"
              >
                <p className="text-sm font-medium text-gray-800 line-clamp-2">{news.title}</p>
                <span className="text-[10px] text-gray-400 mt-2 block">
                  {new Date(news.sent_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </a>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">아직 발송된 속보가 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-sm font-medium text-gray-400 mb-4 px-1 uppercase tracking-wider">관심사 프리셋</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.keys(PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => togglePreset(preset)}
              className={`p-4 rounded-xl text-left transition-all border ${
                subscribedPresets.includes(preset)
                  ? "bg-blue-600 border-blue-600 text-white shadow-md"
                  : "bg-white border-gray-100 text-gray-700 shadow-sm"
              }`}
            >
              <span className="block font-semibold">{preset}</span>
              <span className={`text-[10px] uppercase ${subscribedPresets.includes(preset) ? "text-blue-100" : "text-gray-400"}`}>
                {subscribedPresets.includes(preset) ? "알림 받는 중" : "구독하기"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <footer className="mt-8 text-center text-xs text-gray-400">
        <p>© 2026 Sokbo. Powered by Naver News.</p>
      </footer>
    </main>
  );
}
