import os

path = r"c:\Users\User\Desktop\제미나이 3\연습\claude\projects_001\test_projects\b-messenger\src\app\settings\page.tsx"

content = '''\
// ================================================================
// settings/page.tsx — 설정 페이지
// API 키 설정 (솔라피 / 알리고) + 연결 테스트 + 테스트 발송
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore, ApiSetting } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const DEFAULT_SETTINGS: ApiSetting[] = [
  { provider: "solapi", apiKey: "", apiSecret: "", senderNumber: "", kakaoChannelId: "", isActive: false },
];

type TestStatus = "idle" | "loading" | "success" | "fail";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ApiSetting[]>(DEFAULT_SETTINGS);
  const [activeVendor, setActiveVendor] = useState<"solapi" | "aligo">("solapi");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 연결 테스트
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMsg, setTestMsg] = useState("");

  // 테스트 발송
  const [testPhone, setTestPhone] = useState("");
  const [sendStatus, setSendStatus] = useState<TestStatus>("idle");
  const [sendMsg, setSendMsg] = useState("");

  // 비밀번호 변경
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwMessage, setPwMessage] = useState("");

  // API 키 표시 토글
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  useEffect(() => {
    async function load() {
      const loaded = await dataStore.getApiSettings();
      if (loaded && loaded.length > 0) setSettings(loaded);
    }
    load();
  }, []);

  function handleChange(field: string, value: string | boolean) {
    setSettings(prev =>
      prev.map(s => s.provider === activeVendor ? { ...s, [field]: value } : s)
    );
  }

  async function handleSave() {
    setSaveError("");
    let hasError = false;
    for (const s of settings) {
      const result = await dataStore.updateApiSetting(s.provider, s);
      if (!result) hasError = true;
    }
    if (hasError) {
      setSaveError("저장 실패 — F12 콘솔에서 오류를 확인해주세요.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  async function handleTest() {
    setTestStatus("loading");
    setTestMsg("");
    const current = settings.find(s => s.provider === activeVendor);
    try {
      const res = await fetch("/api/solapi/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: current?.apiKey, apiSecret: current?.apiSecret }),
      });
      const data = await res.json();
      if (data.success && !data.mock) {
        setTestStatus("success");
        setTestMsg("연결이 성공하였습니다. 이제 저장 후 메시지를 보내보세요.");
      } else if (data.mock) {
        setTestStatus("fail");
        setTestMsg("API 키가 입력되지 않았습니다. API 키와 Secret을 먼저 입력하세요.");
      } else {
        setTestStatus("fail");
        setTestMsg("연결이 안되었습니다. API 키를 확인해 주세요.");
      }
    } catch {
      setTestStatus("fail");
      setTestMsg("서버 오류 — B-Messenger가 실행 중인지 확인하세요.");
    }
  }

  async function handleTestSend() {
    const current = settings.find(s => s.provider === activeVendor);
    setSendStatus("loading");
    setSendMsg("");
    try {
      const res = await fetch("/api/solapi/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: current?.apiKey,
          apiSecret: current?.apiSecret,
          senderNumber: current?.senderNumber,
          recipientNumber: testPhone.replace(/[^0-9]/g, ""),
          message: "[B-Messenger] 테스트 발송입니다. 정상 수신되면 설정이 완료된 것입니다!",
          channel: "sms",
        }),
      });
      const data = await res.json();
      if (data.success && !data.mock) {
        setSendStatus("success");
        setSendMsg(`발송 성공! ${testPhone}으로 문자가 전송되었습니다.`);
      } else if (data.mock) {
        setSendStatus("fail");
        setSendMsg("API 키 미설정 — Mock 발송만 됩니다. 실제 API 키를 입력 후 저장하세요.");
      } else {
        setSendStatus("fail");
        setSendMsg(data.message || "발송 실패 — 발신번호와 API 키를 확인해주세요.");
      }
    } catch {
      setSendStatus("fail");
      setSendMsg("발송 실패 — 서버 오류");
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) { setPwMessage("비밀번호가 일치하지 않습니다."); return; }
    if (newPassword.length < 6) { setPwMessage("비밀번호는 6자 이상이어야 합니다."); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) { setPwMessage(`오류: ${error.message}`); }
    else { setPwMessage("비밀번호가 변경되었습니다."); setNewPassword(""); setConfirmPassword(""); }
  }

  const current = settings.find(s => s.provider === activeVendor);
  const isMock = !current?.apiKey || !current?.apiSecret;

  const msgBoxStyle = (status: TestStatus): React.CSSProperties => ({
    marginTop: 12, padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
    background: status === "success" ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
    border: `1px solid ${status === "success" ? "rgba(16,185,129,0.3)" : "rgba(248,113,113,0.3)"}`,
    color: status === "success" ? "#34d399" : "#f87171",
  });

  return (
    <div style={{ animation: "slideInUp 400ms ease both" }}>
      {/* 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-subtitle">발송 API 연동 및 계정 정보를 설정하세요</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? "저장됨!" : "설정 저장"}
        </button>
      </div>

      {saveError && (
        <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
          {saveError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 20 }}>

        {/* 발송 API 설정 카드 */}
        <div className="glass-card" style={{ padding: 28 }}>

          {/* 벤더 탭 */}
          <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 12, marginBottom: 24 }}>
            {(["solapi", "aligo"] as const).map(v => (
              <button
                key={v}
                onClick={() => { setActiveVendor(v); setTestStatus("idle"); setTestMsg(""); setSendStatus("idle"); setSendMsg(""); }}
                style={{
                  flex: 1, padding: "9px 16px", border: "none", borderRadius: 9, cursor: "pointer",
                  fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                  background: activeVendor === v ? "var(--brand-primary, #6366f1)" : "transparent",
                  color: activeVendor === v ? "#fff" : "var(--text-secondary)",
                }}
              >
                {v === "solapi" ? "솔라피 (Solapi)" : "알리고 (Aligo)"}
              </button>
            ))}
          </div>

          {/* 상태 배지 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>
              {activeVendor === "solapi" ? "솔라피 API 설정" : "알리고 API 설정"}
            </div>
            {isMock ? (
              <span className="badge badge-warning">Mock 모드</span>
            ) : (
              <span className="badge badge-success">API 키 입력됨</span>
            )}
            <span className={`badge ${current?.isActive ? "badge-success" : "badge-error"}`}>
              {current?.isActive ? "활성" : "비활성"}
            </span>
          </div>

          {/* API Key */}
          <div className="form-group">
            <label className="form-label">API Key</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showApiKey ? "text" : "password"}
                value={current?.apiKey || ""}
                onChange={e => handleChange("apiKey", e.target.value)}
                placeholder={activeVendor === "solapi" ? "NCSA..." : "알리고 API Key"}
                style={{ paddingRight: 44 }}
              />
              <button
                onClick={() => setShowApiKey(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-secondary)" }}
              >
                {showApiKey ? "숨김" : "보기"}
              </button>
            </div>
          </div>

          {/* API Secret */}
          <div className="form-group">
            <label className="form-label">{activeVendor === "solapi" ? "API Secret" : "알리고 계정 ID (userid)"}</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showApiSecret ? "text" : "password"}
                value={current?.apiSecret || ""}
                onChange={e => handleChange("apiSecret", e.target.value)}
                placeholder={activeVendor === "solapi" ? "API Secret" : "알리고 로그인 아이디"}
                style={{ paddingRight: 44 }}
              />
              <button
                onClick={() => setShowApiSecret(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-secondary)" }}
              >
                {showApiSecret ? "숨김" : "보기"}
              </button>
            </div>
          </div>

          {/* 발신번호 */}
          <div className="form-group">
            <label className="form-label">발신번호</label>
            <input
              className="input"
              value={current?.senderNumber || ""}
              onChange={e => handleChange("senderNumber", e.target.value)}
              placeholder="01012345678"
            />
          </div>

          {/* 카카오 채널 (솔라피만) */}
          {activeVendor === "solapi" && (
            <div className="form-group">
              <label className="form-label">카카오 채널 ID (알림톡/친구톡 사용 시)</label>
              <input
                className="input"
                value={current?.kakaoChannelId || ""}
                onChange={e => handleChange("kakaoChannelId", e.target.value)}
                placeholder="@your_channel (선택사항)"
              />
            </div>
          )}

          {/* 활성화 체크박스 */}
          <div
            className="checkbox-wrapper"
            style={{ marginBottom: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => handleChange("isActive", !current?.isActive)}
          >
            <input type="checkbox" checked={current?.isActive || false} readOnly />
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {activeVendor === "solapi" ? "솔라피" : "알리고"} 연동 활성화
            </span>
          </div>

          {/* 구분선 */}
          <div style={{ borderTop: "1px solid var(--border-primary)", paddingTop: 20 }}>

            {/* 연결 테스트 */}
            <button
              className="btn btn-secondary"
              disabled={testStatus === "loading"}
              onClick={handleTest}
              style={{ width: "100%", marginBottom: 8 }}
            >
              {testStatus === "loading" ? "연결 테스트 중..." : "연결 테스트"}
            </button>

            {testStatus !== "idle" && testMsg && (
              <div style={msgBoxStyle(testStatus)}>
                {testStatus === "success" ? "✅ " : "❌ "}{testMsg}
              </div>
            )}

            {/* 테스트 발송 */}
            <div style={{ marginTop: 16 }}>
              <label className="form-label">테스트 발송 (내 번호로 SMS 발송)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="01012345678"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  disabled={sendStatus === "loading" || !testPhone}
                  onClick={handleTestSend}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {sendStatus === "loading" ? "발송 중..." : "테스트 발송"}
                </button>
              </div>
              {sendStatus !== "idle" && sendMsg && (
                <div style={msgBoxStyle(sendStatus)}>
                  {sendStatus === "success" ? "✅ " : "❌ "}{sendMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 안내 + 가입 카드 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>API 키 발급 안내</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 2 }}>
              <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>솔라피 (SMS + 카카오톡)</p>
              <p>1. solapi.com 회원가입</p>
              <p>2. 콘솔 → API Key 관리 → 새로운 API KEY</p>
              <p>3. CIDR: <strong>모두 IP 허용</strong> 선택</p>
              <p>4. 발신번호 등록 (사업자 인증 필요)</p>
              <div style={{ borderTop: "1px solid var(--border-primary)", margin: "12px 0" }} />
              <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>알리고 (저렴한 SMS)</p>
              <p>1. aligo.in 회원가입</p>
              <p>2. 문자 서비스 신청 → API 키 발급</p>
              <p>3. SMS 기준 솔라피 대비 절반 가격</p>
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>비밀번호 변경</div>
            <div className="form-group">
              <label className="form-label">새 비밀번호</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="6자 이상"
              />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호 확인</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 재입력"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleChangePassword}
              disabled={changingPw || !newPassword || newPassword !== confirmPassword}
              style={{ width: "100%", marginTop: 16 }}
            >
              {changingPw ? "변경 중..." : "비밀번호 업데이트"}
            </button>
            {pwMessage && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                background: pwMessage.includes("변경되었") ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
                border: pwMessage.includes("변경되었") ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(248,113,113,0.3)",
                color: pwMessage.includes("변경되었") ? "#34d399" : "#f87171",
              }}>
                {pwMessage}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
'''

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done:", path)
print("Size:", os.path.getsize(path), "bytes")
