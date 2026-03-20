// ================================================================
// settings/page.tsx — 설정 페이지
// API 키 설정 + 발신 번호 관리
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore, ApiSetting } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ApiSetting[]>([]);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [sending, setSending] = useState(false);

  // 비밀번호 변경용 상태
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwMessage, setPwMessage] = useState("");

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPwMessage("❌ 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      setPwMessage(`❌ 오류: ${error.message}`);
    } else {
      setPwMessage("✅ 비밀번호가 성공적으로 변경되었습니다.");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  useEffect(() => {
    async function load() {
      setSettings(await dataStore.getApiSettings());
    }
    load();
  }, []);

  function handleChange(provider: string, field: string, value: string | boolean) {
    setSettings(prev =>
      prev.map(s => s.provider === provider ? { ...s, [field]: value } : s)
    );
  }

  async function handleSave() {
    for (const s of settings) {
      await dataStore.updateApiSetting(s.provider, s);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const solapi = settings.find(s => s.provider === 'solapi');

  return (
    <div style={{ animation: "slideInUp 400ms ease both" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ 설정</h1>
          <p className="page-subtitle">API 연동 및 발신 정보를 설정하세요</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? "✅ 저장됨!" : "💾 설정 저장"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20 }}>
        {/* 솔라피 설정 */}
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 24,
              border: "1px solid rgba(102,126,234,0.3)"
            }}>📡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>솔라피 (Solapi)</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>SMS / LMS / MMS / 카카오톡 통합 서비스</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <span className={`badge ${solapi?.isActive ? "badge-success" : "badge-error"}`}>
                {solapi?.isActive ? "✅ 활성" : "⛔ 비활성"}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input
              className="input"
              type="password"
              value={solapi?.apiKey || ""}
              onChange={(e) => handleChange("solapi", "apiKey", e.target.value)}
              placeholder="NCSA..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">API Secret</label>
            <input
              className="input"
              type="password"
              value={solapi?.apiSecret || ""}
              onChange={(e) => handleChange("solapi", "apiSecret", e.target.value)}
              placeholder="솔라피 API Secret 키"
            />
          </div>
          <div className="form-group">
            <label className="form-label">발신 번호</label>
            <input
              className="input"
              value={solapi?.senderNumber || ""}
              onChange={(e) => handleChange("solapi", "senderNumber", e.target.value)}
              placeholder="01012345678"
            />
          </div>
          <div className="form-group">
            <label className="form-label">카카오 채널 ID (알림톡/친구톡 사용 시)</label>
            <input
              className="input"
              value={solapi?.kakaoChannelId || ""}
              onChange={(e) => handleChange("solapi", "kakaoChannelId", e.target.value)}
              placeholder="@your_channel"
            />
          </div>
          <div className="checkbox-wrapper" onClick={() => handleChange("solapi", "isActive", !solapi?.isActive)}>
            <input type="checkbox" checked={solapi?.isActive || false} readOnly />
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>솔라피 연동 활성화</span>
          </div>

          {/* 연결 테스트 + 테스트 발송 */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border-primary)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                className="btn btn-secondary"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  setTestResult("");
                  try {
                    const res = await fetch("/api/solapi/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ apiKey: solapi?.apiKey, apiSecret: solapi?.apiSecret }),
                    });
                    const data = await res.json();
                    setTestResult(data.message);
                  } catch { setTestResult("❌ 연결 실패"); }
                  setTesting(false);
                }}
              >
                {testing ? "⏳ 테스트 중..." : "🔌 연결 테스트"}
              </button>
            </div>

            {/* 테스트 발송 */}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">테스트 발송 (내 번호로)</label>
                <input
                  className="input"
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="01012345678"
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={sending || !testPhone}
                onClick={async () => {
                  setSending(true);
                  setTestResult("");
                  try {
                    const res = await fetch("/api/solapi/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        apiKey: solapi?.apiKey,
                        apiSecret: solapi?.apiSecret,
                        senderNumber: solapi?.senderNumber,
                        recipientNumber: testPhone.replace(/[^0-9]/g, ""),
                        message: "[B-Messenger] 테스트 발송입니다. 정상 수신되면 설정이 완료된 것입니다! 🎉",
                        channel: "sms",
                      }),
                    });
                    const data = await res.json();
                    setTestResult(data.message);
                  } catch { setTestResult("❌ 발송 실패"); }
                  setSending(false);
                }}
                style={{ whiteSpace: "nowrap" }}
              >
                {sending ? "⏳ 발송 중..." : "📨 테스트 발송"}
              </button>
            </div>

            {testResult && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10,
                background: testResult.includes("✅") ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
                border: testResult.includes("✅") ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(248,113,113,0.3)",
                color: testResult.includes("✅") ? "#34d399" : "#f87171",
                fontSize: 13,
              }}>
                {testResult}
              </div>
            )}
          </div>
        </div>

        {/* 안내 카드 */}
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "var(--kakao-bg)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 24,
              border: "1px solid rgba(254,229,0,0.2)"
            }}>💡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>솔라피 가입 방법</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>API 키 발급 절차</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            <p>1️⃣ <a href="https://solapi.com" target="_blank" rel="noopener" style={{ color: "var(--brand-primary)" }}>solapi.com</a> 회원가입</p>
            <p>2️⃣ 대시보드 → API 키 발급</p>
            <p>3️⃣ 발신번호 등록 (사업자 인증 필요)</p>
            <p>4️⃣ 카카오 알림톡 사용 시: 카카오 비즈니스 채널 연동</p>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="glass-card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 24,
              border: "1px solid rgba(245,158,11,0.3)"
            }}>🔑</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>비밀번호 변경</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>계정의 비밀번호를 안전하게 변경하세요</div>
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">새 비밀번호</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새로운 비밀번호 (6자 이상)"
            />
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">비밀번호 확인</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
            />
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleChangePassword}
            disabled={changingPw || !newPassword || newPassword !== confirmPassword}
            style={{ width: "100%", marginTop: 24 }}
          >
            {changingPw ? "변경 중..." : "비밀번호 업데이트"}
          </button>
          {pwMessage && (
            <div style={{ 
              marginTop: 12, padding: "10px 14px", borderRadius: 10,
              background: pwMessage.includes("✅") ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
              border: pwMessage.includes("✅") ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(248,113,113,0.3)",
              color: pwMessage.includes("✅") ? "#34d399" : "#f87171",
              fontSize: 13
            }}>
              {pwMessage}
            </div>
          )}
        </div>

      </div>

      {/* 법률 안내 */}
      <div className="glass-card" style={{ padding: 24, marginTop: 20 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>⚖️ 법률 준수 안내</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div style={{ padding: 16, background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>📋 정보통신망법</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              수신자의 사전 동의 없이 광고성 메시지를 발송할 수 없습니다.
            </div>
          </div>
          <div style={{ padding: 16, background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🌙 야간 발송 제한</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              오후 9시 ~ 오전 8시 사이 광고 문자 발송이 금지됩니다.
            </div>
          </div>
          <div style={{ padding: 16, background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🏷️ 광고 표기</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              광고 메시지에는 반드시 (광고) 표기와 수신거부 방법을 포함해야 합니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
