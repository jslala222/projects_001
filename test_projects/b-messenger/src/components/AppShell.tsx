// ================================================================
// AppShell.tsx — 앱 레이아웃 (사이드바 + 헤더 + 콘텐츠)
// 비유: 로그인한 사용자만 볼 수 있는 "앱 내부 인테리어"
// 로그인 페이지에서는 이 쉘이 보이지 않습니다
// ================================================================
"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

// 레이아웃 없이 전체 화면을 사용하는 페이지
const fullScreenPaths = ["/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = fullScreenPaths.includes(pathname);

  return (
    <AuthProvider>
      <AuthGuard>
        {isFullScreen ? (
          // 로그인 페이지: 사이드바/헤더 없이 전체 화면
          <>{children}</>
        ) : (
          // 일반 페이지: 사이드바 + 헤더 + 콘텐츠
          <div className="app-layout">
            <Sidebar />
            <div className="main-content">
              <Header />
              <div className="page-content">
                {children}
              </div>
            </div>
          </div>
        )}
      </AuthGuard>
    </AuthProvider>
  );
}
