// ================================================================
// layout.tsx — B-Messenger 루트 레이아웃
// 전체 앱의 뼈대 — AppShell이 인증 상태에 따라 레이아웃 결정
// ================================================================
import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "B-Messenger — 대량 메시지 발송 플랫폼",
  description: "카카오톡 알림톡/친구톡 + SMS를 한 곳에서 대량 발송하는 올인원 메시징 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

