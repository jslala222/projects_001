// ================================================================
// AppShell.tsx — 앱 레이아웃 (사이드바 + 헤더 + 콘텐츠)
// 비유: 로그인한 사용자만 볼 수 있는 "앱 내부 인테리어"
// 로그인 페이지에서는 이 쉘이 보이지 않습니다
// ================================================================
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

// 레이아웃 없이 전체 화면을 사용하는 페이지
const fullScreenPaths = ["/login"];

// 모바일 하단 내비 메뉴 (5개)
const mobileNavItems = [
  { href: "/",         icon: "📊", label: "홈" },
  { href: "/contacts", icon: "📇", label: "주소록" },
  { href: "/groups",   icon: "👥", label: "그룹" },
  { href: "/messages", icon: "✉️",  label: "메시지" },
  { href: "/settings", icon: "⚙️",  label: "설정" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {/* 모바일: 사이드바 열릴 때 배경 오버레이 */}
            {sidebarOpen && (
              <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}
            <div className="main-content">
              <Header onMenuClick={() => setSidebarOpen(true)} />
              <div className="page-content">
                {children}
              </div>
            </div>

            {/* 모바일 하단 고정 내비게이션 — 768px 이하에서만 표시 */}
            <nav className="mobile-bottom-nav">
              {mobileNavItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mobile-bottom-nav__item${
                      isActive ? " mobile-bottom-nav__item--active" : ""
                    }`}
                  >
                    <span className="mobile-bottom-nav__icon">{item.icon}</span>
                    <span className="mobile-bottom-nav__label">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </AuthGuard>
    </AuthProvider>
  );
}
