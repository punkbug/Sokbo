import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sokbo - 초경량 관심사 속보",
  description: "관심사를 설정하고 가장 빠른 속보 알림을 받으세요.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sokbo",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1730",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
