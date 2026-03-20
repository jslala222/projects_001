// ================================================================
// messages/page.tsx — 메시지 작성 페이지 (핵심 화면!)
// 채널 선택 + 메시지 편집기 + 폰 미리보기 + 발송
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore, Contact, Group } from "@/lib/store";
import styles from "@/styles/messages.module.css";

const channels = [
  { id: "kakao_alim", icon: "💬", label: "카카오 알림톡", desc: "인증된 템플릿 발송" },
  { id: "kakao_friend", icon: "💛", label: "카카오 친구톡", desc: "친구에게 자유 발송" },
  { id: "sms", icon: "📱", label: "SMS 문자", desc: "90바이트 이하 단문" },
  { id: "mms", icon: "🖼️", label: "MMS 문자", desc: "이미지 포함 장문" },
];

export default function MessagesPage() {
  const [selectedChannel, setSelectedChannel] = useState("kakao_friend");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [onlyCustomers, setOnlyCustomers] = useState(false);
  const [message, setMessage] = useState("#{이름}님 안녕하세요! 🌸\n\n3월 봄맞이 특별 할인 이벤트를 안내드립니다.\n\n전 품목 20% 할인 진행 중!\n지금 바로 확인해보세요 👇");
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [sendRate, setSendRate] = useState(300);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // 발송 상태
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendSuccess, setSendSuccess] = useState(0);
  const [sendFail, setSendFail] = useState(0);
  const [sendComplete, setSendComplete] = useState(false);

  useEffect(() => {
    async function load() {
      const [g, c] = await Promise.all([dataStore.getGroups(), dataStore.getContacts()]);
      setGroups(g);
      setContacts(c);
    }
    load();
  }, []);

  // 선택된 그룹 및 고객 여부에 따른 연락처 추출
  const targetContacts = (() => {
    let filtered = contacts;
    
    // 1. 고객 전용 필터 적용
    if (onlyCustomers) {
      filtered = filtered.filter(c => c.isCustomer);
    }
    
    // 2. 그룹 필터 적용 (그룹이 하나라도 선택된 경우)
    if (selectedGroups.length > 0) {
      filtered = filtered.filter(c => c.groupIds.some(g => selectedGroups.includes(g)));
    }
    
    return filtered;
  })();

  // 변수 치환 미리보기
  function getPreviewMessage() {
    let preview = message;
    // targetContacts가 있으면 그 중 첫 번째 사람, 없으면 전체 contacts 중 첫 번째 사람을 샘플로 사용
    const sampleContact = targetContacts.length > 0 ? targetContacts[0] : contacts[0];
    
    if (sampleContact) {
      preview = preview.replace(/#{이름}/g, sampleContact.name);
      preview = preview.replace(/#{메모}/g, sampleContact.memo || "");
      preview = preview.replace(/#{전화번호}/g, sampleContact.phone);
    } else {
      preview = preview.replace(/#{이름}/g, "홍길동");
      preview = preview.replace(/#{메모}/g, "메모 내용");
      preview = preview.replace(/#{전화번호}/g, "010-0000-0000");
    }
    
    // 공통 변수 (샘플 데이터)
    preview = preview.replace(/#{주문번호}/g, "ORD-20260320");
    preview = preview.replace(/#{금액}/g, "59,000");
    preview = preview.replace(/#{운송장번호}/g, "123456789");
    
    return preview;
  }

  // 글자 수 계산
  const byteLength = new TextEncoder().encode(message).length;
  const isOverSMS = selectedChannel === "sms" && byteLength > 90;

  function toggleGroup(groupId: string) {
    setSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  }

  // 발송 시작
  async function handleSend() {
    if (targetContacts.length === 0) {
      alert("발송할 대상이 없습니다.");
      return;
    }

    setIsSending(true);
    setSendProgress(0);
    setSendSuccess(0);
    setSendFail(0);
    setSendComplete(false);

    const campaign = await dataStore.addCampaign({
      name: `${new Date().toLocaleDateString("ko-KR")} 발송`,
      channel: selectedChannel,
      message: message,
      status: "draft",
      totalCount: targetContacts.length,
      successCount: 0,
      failCount: 0,
      sendRate: sendRate,
      fallbackEnabled: fallbackEnabled,
    });

    if (!campaign) {
      alert("캔페인 생성에 실패했습니다.");
      setIsSending(false);
      return;
    }

    await dataStore.simulateSend(
      campaign.id,
      targetContacts,
      (progress, success, fail) => {
        setSendProgress(progress);
        setSendSuccess(success);
        setSendFail(fail);
      }
    );

    setSendComplete(true);
  }

  function handleTestSend() {
    alert(`✅ 테스트 발송 완료!\n\n채널: ${channels.find(c => c.id === selectedChannel)?.label}\n메시지: ${getPreviewMessage().substring(0, 50)}...\n\n(시뮬레이션 - 실제 발송되지 않습니다)`);
  }

  const isKakao = selectedChannel.startsWith("kakao");

  return (
    <div className={styles.messagePage}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">✉️ 새 메시지 작성</h1>
          <p className="page-subtitle">채널을 선택하고 메시지를 작성하세요</p>
        </div>
      </div>

      {/* 3단 레이아웃: 좌(채널+대상) | 중(편집기) | 우(미리보기) */}
      <div className={styles.composer}>
        {/* ── 왼쪽: 채널 선택 + 수신 대상 ── */}
        <div className={styles.leftPanel}>
          {/* 채널 선택 */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>📌 발송 채널</div>
            <div className={styles.channelList}>
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  className={`${styles.channelOption} ${selectedChannel === ch.id ? styles.channelActive : ""}`}
                  onClick={() => setSelectedChannel(ch.id)}
                >
                  <span className={styles.channelIcon}>{ch.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ch.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ch.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 수신 대상 */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>📋 수신 대상 ({targetContacts.length}명)</div>
            <div className={styles.groupList}>
              <button
                className={`${styles.groupOption} ${(!onlyCustomers && selectedGroups.length === 0) ? styles.groupActive : ""}`}
                onClick={() => { setOnlyCustomers(false); setSelectedGroups([]); }}
              >
                <span className={styles.groupDot} style={{ background: "var(--text-muted)" }} />
                전체 연락처
                <span className={styles.groupCount}>{contacts.length}</span>
              </button>

              <button
                className={`${styles.groupOption} ${onlyCustomers ? styles.groupActive : ""}`}
                onClick={() => setOnlyCustomers(!onlyCustomers)}
                style={onlyCustomers ? { border: "1px solid var(--brand-primary)", background: "rgba(102, 126, 234, 0.1)" } : {}}
              >
                <span className={styles.groupDot} style={{ background: "#FFD700" }} />
                💎 등록된 고객만
                <span className={styles.groupCount}>{contacts.filter(c => c.isCustomer).length}</span>
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  className={`${styles.groupOption} ${selectedGroups.includes(g.id) ? styles.groupActive : ""}`}
                  onClick={() => toggleGroup(g.id)}
                >
                  <span className={styles.groupDot} style={{ background: g.color }} />
                  {g.name}
                  <span className={styles.groupCount}>{g.contactCount}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 가운데: 메시지 편집기 ── */}
        <div className={styles.centerPanel}>
          <div className={styles.editorCard}>
            <div className={styles.panelTitle}>💬 메시지 내용</div>

            {/* 변수 힌트 */}
            <div className={styles.variableHint}>
              💡 변수 삽입:
              {["이름", "주문번호", "금액", "메모"].map((v) => (
                <span
                  key={v}
                  className={styles.variableTag}
                  onClick={() => setMessage(prev => prev + `#{${v}}`)}
                >
                  #{`{${v}}`}
                </span>
              ))}
            </div>

            {/* 텍스트 편집기 */}
            <textarea
              className="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요... #{이름}님 같은 변수를 사용할 수 있습니다."
              style={{ minHeight: 200 }}
            />

            {/* 글자 수 */}
            <div className={`${styles.charCount} ${isOverSMS ? styles.charOver : ""}`}>
              {byteLength} 바이트
              {selectedChannel === "sms" && ` / 90 바이트`}
              {isOverSMS && " ⚠️ SMS 한도 초과 (LMS 전환 필요)"}
            </div>

            {/* 옵션 */}
            <div style={{ marginTop: 20 }}>
              <div className={styles.optionRow}>
                <span className={styles.optionLabel}>🔄 카카오 실패 시 문자 자동 전환</span>
                <div
                  className={`${styles.toggle} ${fallbackEnabled ? styles.active : ""}`}
                  onClick={() => setFallbackEnabled(!fallbackEnabled)}
                  style={fallbackEnabled ? { background: "var(--brand-primary)", borderColor: "var(--brand-primary)" } : {}}
                >
                  <div className={styles.toggleDot} style={fallbackEnabled ? { transform: "translateX(20px)" } : {}} />
                </div>
              </div>
              <div className={styles.optionRow}>
                <span className={styles.optionLabel}>🏎️ 발송 속도 (분당 {sendRate}건)</span>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={50}
                  value={sendRate}
                  onChange={(e) => setSendRate(Number(e.target.value))}
                  style={{ width: 120, accentColor: "var(--brand-primary)" }}
                />
              </div>
            </div>
          </div>

          {/* 발송 버튼 */}
          <div className={styles.sendActions}>
            <button className="btn btn-secondary btn-lg" onClick={handleTestSend}>
              🧪 테스트 발송
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleSend}>
              🚀 {targetContacts.length}명에게 발송하기
            </button>
          </div>
        </div>

        {/* ── 오른쪽: 폰 미리보기 ── */}
        <div className={styles.rightPanel}>
          <div className={styles.previewCard}>
            <div className={styles.panelTitle}>📱 미리보기</div>

            {/* 폰 */}
            <div className={styles.phone}>
              <div className={styles.phoneScreen}>
                <div className={`${styles.phoneHeader} ${isKakao ? styles.phoneHeaderKakao : ""}`}>
                  <div className={styles.phoneAvatar}>{isKakao ? "💛" : "📱"}</div>
                  <span>{isKakao ? "카카오톡" : "문자"}</span>
                </div>
                <div className={styles.phoneBody}>
                  <div className={`${styles.messageBubble} ${isKakao ? styles.messageBubbleKakao : ""}`}>
                    {getPreviewMessage().split("\n").map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < getPreviewMessage().split("\n").length - 1 && <br />}
                      </span>
                    ))}
                    {isKakao && (
                      <div className={styles.kakaoButtons}>
                        <div className={styles.kakaoBtn}>자세히 보기</div>
                      </div>
                    )}
                  </div>
                  <div className={styles.messageTime}>오후 2:30</div>
                </div>
              </div>
            </div>

            {/* 발송 요약 */}
            <div style={{ marginTop: 16, width: "100%", fontSize: 13, color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>채널</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {channels.find(c => c.id === selectedChannel)?.label}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>수신자</span>
                <span style={{ fontWeight: 600, color: "var(--brand-primary)" }}>
                  {targetContacts.length}명 {onlyCustomers && "(⭐ 고객 전용)"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>폴백</span>
                <span style={{ fontWeight: 600, color: fallbackEnabled ? "var(--success)" : "var(--text-muted)" }}>
                  {fallbackEnabled ? "✅ 활성" : "비활성"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 발송 진행 모달 */}
      {isSending && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className={styles.progressModal}>
              <div className={styles.progressTitle}>
                {sendComplete ? "🎉 발송 완료!" : "🚀 대량 발송 진행 중..."}
              </div>

              <div className={styles.progressBarLarge}>
                <div
                  className={styles.progressFillLarge}
                  style={{ width: `${sendProgress}%` }}
                />
              </div>

              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                {Math.round(sendProgress)}%
              </div>

              <div className={styles.progressStats}>
                <div className={styles.progressStat}>
                  <div className={`${styles.progressStatValue} ${styles.progressSuccess}`}>{sendSuccess}</div>
                  <div className={styles.progressStatLabel}>✅ 성공</div>
                </div>
                <div className={styles.progressStat}>
                  <div className={`${styles.progressStatValue} ${styles.progressFail}`}>{sendFail}</div>
                  <div className={styles.progressStatLabel}>❌ 실패</div>
                </div>
                <div className={styles.progressStat}>
                  <div className={`${styles.progressStatValue} ${styles.progressPending}`}>
                    {targetContacts.length - sendSuccess - sendFail}
                  </div>
                  <div className={styles.progressStatLabel}>⏳ 대기</div>
                </div>
              </div>

              {/* 실시간 치환 샘플 (최종 수신자 1인 기준) */}
              <div style={{ marginTop: 20, textAlign: "left", fontSize: 13, background: "rgba(255,255,255,0.05)", padding: 12, borderRadius: 8, border: "1px solid var(--border-primary)" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: 8, fontSize: 11 }}>📝 첫 번째 수신자 발송 예시 ({targetContacts[0]?.name || "없음"})</div>
                <div style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {getPreviewMessage()}
                </div>
              </div>

              {sendComplete && (
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%" }}
                  onClick={() => { setIsSending(false); setSendComplete(false); }}
                >
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
