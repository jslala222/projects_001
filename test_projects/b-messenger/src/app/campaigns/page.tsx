// ================================================================
// campaigns/page.tsx — 발송 이력 페이지
// 캠페인별 발송 결과를 확인하고 실패 건 재발송 가능
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore, Campaign } from "@/lib/store";
import styles from "@/styles/campaigns.module.css";

const statusLabels: Record<string, { label: string; badge: string }> = {
  completed: { label: "완료", badge: "badge-success" },
  sending: { label: "발송 중", badge: "badge-warning" },
  scheduled: { label: "예약됨", badge: "badge-info" },
  paused: { label: "일시정지", badge: "badge-error" },
  draft: { label: "대기", badge: "" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setCampaigns(await dataStore.getCampaigns());
    }
    load();
  }, []);

  const filtered = filter === "all"
    ? campaigns
    : campaigns.filter(c => c.status === filter);

  return (
    <div className={styles.campaignsPage}>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 발송 이력</h1>
          <p className="page-subtitle">캠페인별 발송 결과를 확인하세요</p>
        </div>
      </div>

      {/* 필터 */}
      <div className={styles.filterBar}>
        {[
          { id: "all", label: "전체" },
          { id: "completed", label: "✅ 완료" },
          { id: "sending", label: "🔄 발송 중" },
          { id: "scheduled", label: "📅 예약" },
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

      {/* 캠페인 목록 */}
      <div className={styles.campaignList}>
        {filtered.map((campaign) => {
          const isKakao = campaign.channel.startsWith("kakao");
          const rate = campaign.totalCount > 0
            ? Math.round((campaign.successCount / campaign.totalCount) * 100)
            : 0;
          const st = statusLabels[campaign.status] || statusLabels.draft;

          return (
            <div className={styles.campaignCard} key={campaign.id}>
              {/* 아이콘 */}
              <div className={`${styles.campaignCardIcon} ${isKakao ? styles.iconKakao : styles.iconSms}`}>
                {isKakao ? "💬" : "📱"}
              </div>

              {/* 정보 */}
              <div className={styles.campaignCardInfo}>
                <div className={styles.campaignCardName}>{campaign.name}</div>
                <div className={styles.campaignCardMeta}>
                  <span className={`badge ${st.badge}`}>{st.label}</span>
                  <span className={styles.metaDot} />
                  <span>{isKakao ? "카카오톡" : "SMS"}</span>
                  <span className={styles.metaDot} />
                  <span>
                    {campaign.startedAt
                      ? new Date(campaign.startedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : campaign.scheduledAt
                      ? `예약: ${new Date(campaign.scheduledAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                      : "—"}
                  </span>
                </div>
              </div>

              {/* 진행률 */}
              <div className={styles.campaignCardProgress}>
                <div className={styles.progressInfo}>
                  <span>진행률</span>
                  <span className={styles.progressPercent}>{rate}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${rate}%` }} />
                </div>
              </div>

              {/* 통계 */}
              <div className={styles.campaignCardStats}>
                <div className={styles.statMini}>
                  <div className={`${styles.statMiniValue} ${styles.totalText}`}>
                    {campaign.totalCount.toLocaleString()}
                  </div>
                  <div className={styles.statMiniLabel}>전체</div>
                </div>
                <div className={styles.statMini}>
                  <div className={`${styles.statMiniValue} ${styles.successText}`}>
                    {campaign.successCount.toLocaleString()}
                  </div>
                  <div className={styles.statMiniLabel}>성공</div>
                </div>
                <div className={styles.statMini}>
                  <div className={`${styles.statMiniValue} ${styles.failText}`}>
                    {campaign.failCount.toLocaleString()}
                  </div>
                  <div className={styles.statMiniLabel}>실패</div>
                </div>
              </div>
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
    </div>
  );
}
