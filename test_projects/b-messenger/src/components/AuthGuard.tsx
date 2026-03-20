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
  const { user, loading, isAdmin, userStatus, signOut } = useAuth();
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

  // 로그인 상태인데 승인 대기 중인 경우 (관리자는 예외)
  if (user && userStatus === "pending" && !isAdmin && !isPublicPage) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)",
        gap: 16, textAlign: "center", padding: 24, zIndex: 9999, position: "relative"
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>가입 승인 대기 중</h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.6 }}>
          관리자의 승인 이후에 서비스 무단 이용 및 발송이 가능합니다.<br/>
          승인 처리를 기다려주세요.
        </p>
        <button 
          className="btn btn-secondary" 
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          style={{ marginTop: 16 }}
        >
          돌아가기 (로그아웃)
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
