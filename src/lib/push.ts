import webpush from "web-push";

const vapidKeys = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
};

webpush.setVapidDetails(
  "mailto:your-email@example.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export const sendPushNotification = async (
  subscriptions: any[],
  title: string,
  body: string,
  link: string
) => {
  const payload = JSON.stringify({
    title,
    body,
    url: link,
  });

  const pushPromises = subscriptions.map((sub) =>
    webpush.sendNotification(sub, payload).catch((error) => {
      console.error("Push error:", error);
      // 만약 구독이 만료되었다면(404, 410) DB에서 삭제하는 로직을 추가할 수 있습니다.
    })
  );

  await Promise.all(pushPromises);
};
