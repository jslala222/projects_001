// ================================================================
// scheduled/page.tsx — 예약 발송 페이지
// 발송 시간을 지정해 자동으로 메시지를 발송합니다
// ================================================================
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { formatKSTLocale } from "@/lib/utils";
import styles from "@/styles/scheduled.module.css";
import RecipientInput, { type Recipient } from "@/components/RecipientInput";

// ── 타입 ──────────────────────────────────────────────────────────
interface ScheduledSend {
  id: string;
  title: string;
  message: string;
  channel: string;
  recipients: Recipient[];
  scheduled_at: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  sent_at?: string;
  success_count: number;
  fail_count: number;
  created_at: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  lms: "LMS",
  mms: "MMS",
  kakao_alim: "카카오 알림톡",
  kakao_friend: "카카오 친구톡",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:   { label: "대기 중", badge: "badge-warning" },
  sent:      { label: "발송 완료", badge: "badge-success" },
  cancelled: { label: "취소됨", badge: "" },
  failed:    { label: "실패", badge: "badge-error" },
};

// ── 빈 폼 초기값 ──────────────────────────────────────────────────
const EMPTY_FORM = {
  title: "",
  message: "",
  channel: "sms",
  scheduledAt: "",
};

// ── 유틸: 토큰 가져오기 ───────────────────────────────────────────
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function ScheduledPage() {
  const [items, setItems] = useState<ScheduledSend[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── 목록 불러오기 ────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    const token = await getAuthToken();
    if (!token) { setLoading(false); return; }

    try {
      const url = filter === "all"
        ? "/api/scheduled/list"
        : `/api/scheduled/list?status=${filter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setItems(json.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ── 예약 취소 ────────────────────────────────────────────────────
  async function handleCancel(id: string) {
    if (!confirm("예약을 취소하시겠습니까?")) return;
    const token = await getAuthToken();
    if (!token) return;

    const res = await fetch("/api/scheduled/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (json.success) {
      await loadItems();
    } else {
      alert(json.message || "취소 실패");
    }
  }

  // ── 수동 처리 트리거 (테스트용) ──────────────────────────────────
  async function handleProcess() {
    setProcessing(true);
    try {
      const res = await fetch("/api/scheduled/process", { method: "POST" });
      const json = await res.json();
      alert(json.message || "처리 완료");
      await loadItems();
    } finally {
      setProcessing(false);
    }
  }

  // ── 예약 등록 ────────────────────────────────────────────────────
  async function handleSave() {
    setError("");

    if (!form.title.trim()) { setError("제목을 입력하세요."); return; }
    if (!form.message.trim()) { setError("메시지 내용을 입력하세요."); return; }
    if (!form.scheduledAt) { setError("예약 날짜/시간을 선택하세요."); return; }
    if (recipients.length === 0) { setError("수신자를 1명 이상 추가하세요."); return; }

    const invalidCount = recipients.filter(r => !r.valid).length;
    if (invalidCount > 0) {
      setError(`번호 형식 오류 ${invalidCount}건이 있습니다. 칩(태그)을 삭제하거나 수정해주세요.`);
      return;
    }

    const scheduledDate = new Date(form.scheduledAt);
    if (scheduledDate <= new Date()) {
      setError("예약 시간은 현재 시간 이후로 설정해주세요.");
      return;
    }

    const token = await getAuthToken();
    if (!token) { setError("로그인이 필요합니다."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/scheduled/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title,
          message: form.message,
          channel: form.channel,
          recipients: recipients.map(r => ({ name: r.name, phone: r.phone })),
          scheduled_at: scheduledDate.toISOString(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        setForm({ ...EMPTY_FORM });
        setRecipients([]);
        await loadItems();
      } else {
        setError(json.message || "등록 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  // ── 최솟값 설정 (현재 시간 + 5분) ────────────────────────────────
  function getMinDateTime() {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);

  // ── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className={styles.scheduledPage}>
      {/* 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className="page-title">📅 예약 발송</h1>
          <p className="page-subtitle">발송 시간을 지정해 자동으로 메시지를 발송합니다</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleProcess}
            disabled={processing}
            title="대기 중인 예약 건을 지금 처리합니다 (테스트용)"
          >
            {processing ? "처리 중…" : "🔄 지금 처리"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { setForm({ ...EMPTY_FORM }); setRecipients([]); setError(""); setShowModal(true); }}
          >
            + 예약 등록
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className={styles.filterBar}>
        {[
          { id: "all",       label: "전체" },
          { id: "pending",   label: "⏳ 대기 중" },
          { id: "sent",      label: "✅ 완료" },
          { id: "failed",    label: "❌ 실패" },
          { id: "cancelled", label: "🚫 취소됨" },
        ].map(f => (
          <button
            key={f.id}
            className={`btn ${filter === f.id ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📅</div>
          <div className={styles.emptyText}>예약된 발송이 없습니다</div>
          <div className={styles.emptyDesc}>
            {filter === "all"
              ? "'+ 예약 등록' 버튼으로 첫 예약 발송을 등록해보세요."
              : `${STATUS_CONFIG[filter]?.label ?? "해당"} 상태의 예약이 없습니다.`}
          </div>
        </div>
      ) : (
        <div className={styles.cardList}>
          {filtered.map(item => {
            const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            const chLabel = CHANNEL_LABELS[item.channel] ?? item.channel.toUpperCase();
            const recipientCount = item.recipients?.length ?? 0;

            return (
              <div className={styles.card} key={item.id}>
                {/* 아이콘 */}
                <div className={styles.cardIcon}>
                  {item.channel.startsWith("kakao") ? "💬" : "📱"}
                </div>

                {/* 정보 */}
                <div className={styles.cardInfo}>
                  <div className={styles.cardTitle}>{item.title}</div>
                  <div className={styles.cardMeta}>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                    <span className={styles.metaDot} />
                    <span>{chLabel}</span>
                    <span className={styles.metaDot} />
                    <span>수신자 {recipientCount}명</span>
                    <span className={styles.metaDot} />
                    <span>
                      {item.status === "sent" && item.sent_at
                        ? `발송: ${formatKSTLocale(new Date(item.sent_at))}`
                        : `예약: ${formatKSTLocale(new Date(item.scheduled_at))}`}
                    </span>
                    {item.status === "sent" && (
                      <>
                        <span className={styles.metaDot} />
                        <span style={{ color: "#4ade80" }}>성공 {item.success_count}</span>
                        {item.fail_count > 0 && (
                          <span style={{ color: "#f87171" }}>/ 실패 {item.fail_count}</span>
                        )}
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 }}>
                    {item.message}
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className={styles.cardActions}>
                  {item.status === "pending" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                      onClick={() => handleCancel(item.id)}
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 예약 등록 모달 */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>📅 예약 발송 등록</div>

            {error && (
              <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13, marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            {/* 제목 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                제목 <span className={styles.required}>*</span>
              </label>
              <input
                className={styles.input}
                placeholder="예: 3월 프로모션 발송"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* 채널 선택 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                발송 채널 <span className={styles.required}>*</span>
              </label>
              <select
                className={styles.select}
                value={form.channel}
                onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              >
                <option value="sms">SMS (90자 이내)</option>
                <option value="lms">LMS (장문, 2000자)</option>
                <option value="mms">MMS (이미지 포함)</option>
                <option value="kakao_alim">카카오 알림톡</option>
                <option value="kakao_friend">카카오 친구톡</option>
              </select>
            </div>

            {/* 메시지 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                메시지 내용 <span className={styles.required}>*</span>
              </label>
              <textarea
                className={styles.textarea}
                placeholder="발송할 메시지를 입력하세요."
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              />
              <div className={styles.charCount}>{form.message.length}자</div>
            </div>

            {/* 수신자 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                수신자 <span className={styles.required}>*</span>
              </label>
              <RecipientInput value={recipients} onChange={setRecipients} />
            </div>

            {/* 예약 날짜/시간 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                예약 날짜/시간 <span className={styles.required}>*</span>
              </label>
              <input
                type="datetime-local"
                className={styles.input}
                min={getMinDateTime()}
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              />
              <div className={styles.hint}>⏰ 현재 시간 기준 최소 5분 이후로 설정해주세요.</div>
            </div>

            {/* 버튼 */}
            <div className={styles.modalFooter}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "등록 중…" : "📅 예약 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
