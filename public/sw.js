self.addEventListener("push", (event) => {
  let data = {
    title: "속보",
    body: "새로운 소식이 도착했습니다.",
    url: "/",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // JSON 파싱 실패 시 (예: DevTools에서 평문을 보낸 경우)
      data = {
        title: "속보 알림",
        body: event.data.text(),
        url: "/",
      };
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon.png",
    badge: "/icons/icon.png",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || "속보", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
