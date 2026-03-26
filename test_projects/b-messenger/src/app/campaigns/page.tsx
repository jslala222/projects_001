// ================================================================
// campaigns/page.tsx — 발송 이력 페이지
// FREE: 🔒 잠금 배너  |  PRO: 최근 30일  |  ENT: 무제한
// ================================================================
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePlan } from "@/hooks/usePlan";
import { getCampaigns, getCampaignLogs, type CampaignSummary, type CampaignLog } from "@/app/actions/campaigns";
import styles from "@/styles/campaigns.module.css";

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  completed: { label: "완료",     badge: "badge-success" },
  sending:   { label: "발송 중", badge: "badge-warning" },
  scheduled: { label: "예약됨",  badge: "badge-info" },
  paused:    { label: "일시정지", badge: "badge-error" },
  draft:     { label: "대기",     badge: "" },
};

const LOG_STATUS_COLORS: Record<string, string> = {
  sent:     "#22c55e",
  failed:   "#ef4444",
  fallback: "#f59e0b",
  pending:  "#94a3b8",
};

export default function CampaignsPage() {
  const { plan, isAtLeast } = usePlan();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<CampaignLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (plan === "free") return;
    setLoading(true);
    getCampaigns(plan).then(({ data, error }) => {
      setLoading(false);
      if (error) { setError(error); return; }
      setCampaigns(data ?? []);
    });
  }, [plan]);

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setLogs([]);
    setLogsLoading(true);
    const { data } = await getCampaignLogs(id, plan);
    setLogs(data ?? []);
    setLogsLoading(false);
  }

  if (!isAtLeast("pro")) {
    return (
      <div style={{ padding: "24px 32px" }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">📋 발송 이력</h1>
            <p className="page-subtitle">캠페인별 발송 결과를 확인하세요</p>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "80px 24px", background: "var(--bg-glass)", border: "1px solid var(--border-primary)", borderRadius: "var(--radius-lg)", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>발송 이력 조회</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
            이 기능은{" "}
            <span style={{ fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.1)", padding: "2px 8px", borderRadius: 999, fontSize: 13 }}>PRO</span>{" "}
            이상 플랜에서 사용할 수 있습니다.
          </p>
          <Link href="/pricing" style={{ display: "inline-block", padding: "10px 28px", background: "#7c3aed", color: "#fff", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            플랜 업그레이드 →
          </Link>
        </div>
      </div>
    );
  }

  const filtered = filter === "all"
    ? campaigns
    : campaigns.filter(c => c.status === filter);

  return (
    <div className={styles.campaignsPage}>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 발송 이력</h1>
          <p className="page-subtitle">
            {plan === "pro" ? "최근 30일 발송 기록" : "전체 발송 기록"}
          </p>
        </div>
      </div>

      <div className={styles.filterBar}>
        {[
          { id: "all",       label: "전체" },
          { id: "completed", label: "✅ 완료" },
          { id: "sending",   label: "🔄 발송 중" },
          { id: "scheduled", label: "📅 예약" },
          { id: "paused",    label: "⏸ 일시정지" },
        ].map((f) => (
          <button
            key={f.id}
            className={`btn ${filter === f.id ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state glass-card" style={{ padding: 60 }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <div className="empty-state-title" style={{ marginTop: 12 }}>불러오는 중...</div>
        </div>
      ) : error ? (
        <div className="empty-state glass-card" style={{ padding: 60 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div className="empty-state-title" style={{ marginTop: 12 }}>{error}</div>
        </div>
      ) : (
        <div className={styles.campaignList}>
          {filtered.map((campaign) => {
            const isKakao = campaign.channel.startsWith("kakao");
            const rate = campaign.totalCount > 0
              ? Math.round((campaign.successCount / campaign.totalCount) * 100)
              : 0;
            const st = STATUS_LABELS[campaign.status] ?? STATUS_LABELS.draft;
            const isExpanded = expandedId === campaign.id;

            return (
              <div key={campaign.id}>
                <div className={styles.campaignCard} onClick={() => handleExpand(campaign.id)}>
                  <div className={`${styles.campaignCardIcon} ${isKakao ? styles.iconKakao : styles.iconSms}`}>
                    {isKakao ? "💬" : "📱"}
                  </div>
                  <div className={styles.campaignCardInfo}>
                    <div className={styles.campaignCardName}>{campaign.name}</div>
                    <div className={styles.campaignCardMeta}>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                      <span className={styles.metaDot} />
                      <span>{isKakao ? "카카오톡" : "SMS/LMS"}</span>
                      <span className={styles.metaDot} />
                      <span>
                        {campaign.startedAt
                          ? new Date(campaign.startedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
                          : campaign.scheduledAt
                          ? `예약: ${new Date(campaign.scheduledAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}`
                          : new Date(campaign.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.campaignCardProgress}>
                    <div className={styles.progressInfo}>
                      <span>성공률</span>
                      <span className={styles.progressPercent}>{rate}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                  <div className={styles.campaignCardStats}>
                    <div className={styles.statMini}>
                      <div className={`${styles.statMiniValue} ${styles.totalText}`}>{campaign.totalCount.toLocaleString()}</div>
                      <div className={styles.statMiniLabel}>전체</div>
                    </div>
                    <div className={styles.statMini}>
                      <div className={`${styles.statMiniValue} ${styles.successText}`}>{campaign.successCount.toLocaleString()}</div>
                      <div className={styles.statMiniLabel}>성공</div>
                    </div>
                    <div className={styles.statMini}>
                      <div className={`${styles.statMiniValue} ${styles.failText}`}>{campaign.failCount.toLocaleString()}</div>
                      <div className={styles.statMiniLabel}>실패</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
                      {isExpanded ? "▲" : "▼"}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ border: "1px solid var(--border-primary)", borderTop: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", padding: "12px 24px", background: "var(--bg-primary)" }}>
                    {logsLoading ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>로그 불러오는 중...</p>
                    ) : logs.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>발송 로그가 없습니다.</p>
                    ) : (
                      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-primary)" }}>
                            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>이름</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>전화번호</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>채널</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>상태</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>발송시각</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>오류</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => (
                            <tr key={log.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                              <td style={{ padding: "6px 8px" }}>{log.contactName}</td>
                              <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{log.contactPhone}</td>
                              <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{log.channelUsed}</td>
                              <td style={{ padding: "6px 8px" }}>
                                <span style={{ color: LOG_STATUS_COLORS[log.status] ?? "#94a3b8", fontWeight: 600 }}>
                                  {log.status === "sent" ? "✓ 성공" : log.status === "failed" ? "✗ 실패" : log.status === "fallback" ? "↩ 대체" : "대기"}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px", color: "var(--text-secondary)", fontSize: 12 }}>
                                {log.sentAt ? new Date(log.sentAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
                              </td>
                              <td style={{ padding: "6px 8px", color: "#ef4444", fontSize: 12 }}>{log.errorMessage ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="empty-state glass-card" style={{ padding: 60 }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">발송 이력이 없습니다</div>
              <div className="empty-state-desc">메시지를 작성하고 발송하면 여기에 기록됩니다</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}