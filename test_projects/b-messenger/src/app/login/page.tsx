// ================================================================
// login/page.tsx — 로그인 / 회원가입 페이지
// 비유: 앱의 "현관문" — 여기를 통과해야 안에 들어갈 수 있음
// ================================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  // 로그인 / 회원가입 모드 전환
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "signup") {
      // 유효성 검사
      if (!name.trim()) {
        setError("이름을 입력해주세요.");
        setLoading(false);
        return;
      }
      if (!phone.trim() || phone.replace(/[^0-9]/g, "").length < 10) {
        setError("휴대폰 번호를 정확히 입력해주세요. (10~11자리)");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("비밀번호는 6자 이상이어야 합니다.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("비밀번호가 일치하지 않습니다.");
        setLoading(false);
        return;
      }

      const { error: signUpError } = await signUp(email, password, name, phone.replace(/[^0-9]/g, ""));
      if (signUpError) {
        setError(signUpError);
      } else {
        // 이메일 인증 OFF 상태: 회원가입 후 바로 로그인 시도
        const { error: loginErr } = await signIn(email, password);
        if (loginErr) {
          setSignupSuccess(true); // 로그인 실패시 성공 화면 표시
        } else {
          router.push("/");
        }
      }
    } else {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError);
      } else {
        router.push("/");
      }
    }

    setLoading(false);
  }

  // 회원가입 성공 화면
  if (signupSuccess) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>회원가입 완료!</h2>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
              계정이 성공적으로 생성되었습니다.<br />
              로그인 후 서비스를 이용해주세요.
            </p>
            <button
              style={primaryBtnStyle}
              onClick={() => { setMode("login"); setSignupSuccess(false); }}
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 12px",
            boxShadow: "0 8px 24px rgba(102,126,234,0.3)",
          }}>📱</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>B-Messenger</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            대량 메시지 발송 플랫폼
          </p>
        </div>

        {/* 모드 전환 탭 */}
        <div style={{
          display: "flex", gap: 0, marginBottom: 28,
          background: "var(--bg-glass)", borderRadius: 12,
          padding: 4, border: "1px solid var(--border-primary)",
        }}>
          <button
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              cursor: "pointer", fontWeight: 600, fontSize: 14,
              transition: "all 200ms",
              background: mode === "login" ? "var(--brand-primary)" : "transparent",
              color: mode === "login" ? "#fff" : "var(--text-secondary)",
            }}
            onClick={() => { setMode("login"); setError(""); }}
          >
            로그인
          </button>
          <button
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
              cursor: "pointer", fontWeight: 600, fontSize: 14,
              transition: "all 200ms",
              background: mode === "signup" ? "var(--brand-primary)" : "transparent",
              color: mode === "signup" ? "#fff" : "var(--text-secondary)",
            }}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <div style={formGroupStyle}>
                <label style={labelStyle}>이름 *</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>휴대폰 번호 *</label>
                <input
                  style={inputStyle}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="010-1234-5678"
                  maxLength={13}
                  required
                />
              </div>
            </>
          )}

          <div style={formGroupStyle}>
            <label style={labelStyle}>이메일</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>비밀번호</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              required
              minLength={6}
            />
          </div>

          {mode === "signup" && (
            <div style={formGroupStyle}>
              <label style={labelStyle}>비밀번호 확인</label>
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 다시 입력"
                required
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171", fontSize: 13, marginBottom: 16,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            ...primaryBtnStyle,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading
              ? "⏳ 처리 중..."
              : mode === "login"
              ? "🚀 로그인"
              : "✨ 회원가입"
            }
          </button>
        </form>

        {/* 하단 안내 */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "login"
            ? "아직 계정이 없으신가요? 위의 '회원가입' 탭을 클릭하세요"
            : "이미 계정이 있으신가요? '로그인' 탭을 클릭하세요"
          }
        </div>
      </div>
    </div>
  );
}

// ── 스타일 상수 ──
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: 36,
  borderRadius: 24,
  background: "rgba(26, 26, 46, 0.95)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(102, 126, 234, 0.15)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(102,126,234,0.08)",
};

const formGroupStyle: React.CSSProperties = {
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-glass)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  transition: "border-color 200ms",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #667eea, #764ba2)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 200ms",
  boxShadow: "0 4px 16px rgba(102,126,234,0.3)",
};
