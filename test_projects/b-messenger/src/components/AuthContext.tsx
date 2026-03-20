// ================================================================
// AuthContext.tsx — 인증 상태 관리 (전역 컨텍스트)
// 비유: 앱 전체에 "지금 누가 로그인했는지" 알려주는 안내방송
// ================================================================
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { resetTenantId } from "@/lib/store";

// 인증 상태 타입
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;         // 관리자 여부
  userStatus: string;       // 승인 상태 (pending/approved/rejected)
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 인증 상태를 자식 컴포넌트에 전달하는 Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userStatus, setUserStatus] = useState("pending");

  // 앱 시작 시 기존 세션 확인
  useEffect(() => {
    async function initAuth() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      // DB에서 role/status 조회
      if (currentSession?.user) {
        const { data: profile } = await supabase
          .from("b-messenger_users")
          .select("role, status")
          .eq("id", currentSession.user.id)
          .single();
        if (profile) {
          setIsAdmin(profile.role === "admin");
          setUserStatus(profile.status || "pending");
        }
      }
      setLoading(false);
    }
    initAuth();

    // 인증 상태 변화 감지 (로그인/로그아웃)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // 컴포넌트 언마운트 시 구독 해제
    return () => subscription.unsubscribe();
  }, []);

  // 회원가입
  async function signUp(email: string, password: string, name: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone }, // 사용자 메타데이터에 이름+전화번호 저장
      },
    });

    if (error) {
      return { error: error.message };
    }

    // b-messenger_users 테이블에도 사용자 생성
    if (data.user) {
      await supabase.from("b-messenger_users").upsert(
        {
          id: data.user.id,
          email: data.user.email,
          name: name,
          phone: phone,
          plan: "free",
        },
        { onConflict: "email" }
      );
    }

    return { error: null };
  }

  // 로그인
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 에러 메시지 한국어 변환
      const messages: Record<string, string> = {
        "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
        "Email not confirmed": "이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.",
      };
      return { error: messages[error.message] || error.message };
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    resetTenantId();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setUserStatus("pending");
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, userStatus, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// 인증 상태 사용 훅
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }
  return context;
}
