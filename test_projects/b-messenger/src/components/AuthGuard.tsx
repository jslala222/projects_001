// ================================================================
// AuthGuard.tsx — 인증 보호 래퍼
// 비유: 앱의 "경비원" — 로그인 안 된 사람은 로그인 페이지로 보냄
// ================================================================
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

// 인증 없이 접근 가능한 페이지 목록
const publicPaths = ["/login"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = publicPaths.includes(pathname);

  useEffect(() => {
    if (loading) return; // 아직 세션 확인 중

    if (!user && !isPublicPage) {
      // 로그인 안 된 상태에서 보호된 페이지 접근 → 로그인으로
      router.replace("/login");
    }

    if (user && isPublicPage) {
      // 이미 로그인된 상태에서 로그인 페이지 접근 → 대시보드로
      router.replace("/");
    }
  }, [user, loading, isPublicPage, router]);

  // 로딩 중일 때 스플래시 화면
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)",
        gap: 16,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: "linear-gradient(135deg, #667eea, #764ba2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
          boxShadow: "0 8px 24px rgba(102,126,234,0.3)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}>📱</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  // 비로그인 + 보호된 페이지 → 아무것도 안 보여줌 (리다이렉트 대기)
  if (!user && !isPublicPage) return null;

  // 로그인 + 공개 페이지 → 아무것도 안 보여줌 (리다이렉트 대기)
  if (user && isPublicPage) return null;

  return <>{children}</>;
}
