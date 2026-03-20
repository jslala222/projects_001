// ================================================================
// page.tsx — 대시보드 (홈 화면)
// 발송 통계, 차트, 최근 캠페인을 한눈에 보여줍니다
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore } from "@/lib/store";
import styles from "@/styles/dashboard.module.css";

export default function DashboardPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof dataStore.getStats>> | null>(null);
  const [campaigns, setCampaigns] = useState<Awaited<ReturnType<typeof dataStore.getCampaigns>>>([]);

  useEffect(() => {
    async function loadData() {
      const [statsData, campaignsData] = await Promise.all([
        dataStore.getStats(),
        dataStore.getCampaigns(),
      ]);
      setStats(statsData);
      setCampaigns(campaignsData);
    }
    loadData();
  }, []);

  if (!stats) return null;

  const channelTotal = stats.channelStats.kakao + stats.channelStats.sms;

  return (
    <div className={styles.dashboard}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 대시보드</h1>
          <p className="page-subtitle">발송 현황을 한눈에 확인하세요</p>
        </div>
      </div>

      {/* 통계 카드 4개 */}
      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} animate-slide-up stagger-1`}>
          <div className={styles.statIcon}>📇</div>
          <div className={styles.statValue}>{stats.totalContacts.toLocaleString()}</div>
          <div className={styles.statLabel}>전체 연락처</div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ +3 이번 주</div>
        </div>

        <div className={`${styles.statCard} animate-slide-up stagger-2`}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statValue}>{stats.totalSent.toLocaleString()}</div>
          <div className={styles.statLabel}>발송 성공</div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ {stats.successRate}% 성공률</div>
        </div>

        <div className={`${styles.statCard} animate-slide-up stagger-3`}>
          <div className={styles.statIcon}>📤</div>
          <div className={styles.statValue}>{stats.totalCampaigns}</div>
          <div className={styles.statLabel}>전체 캠페인</div>
          <div className={`${styles.statChange} ${styles.statUp}`}>↑ +2 이번 달</div>
        </div>

        <div className={`${styles.statCard} animate-slide-up stagger-4`}>
          <div className={styles.statIcon}>❌</div>
          <div className={styles.statValue}>{stats.totalFailed}</div>
          <div className={styles.statLabel}>발송 실패</div>
          <div className={`${styles.statChange} ${styles.statDown}`}>↓ 감소 추세</div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className={styles.chartsGrid}>
        {/* 일별 발송 추이 (바 차트) */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>📈 최근 7일 발송 추이</div>
          <div className={styles.barChart}>
            {stats.dailyStats.map((day, index) => {
              const maxVal = Math.max(...stats.dailyStats.map(d => d.sent));
              const height = maxVal > 0 ? (day.sent / maxVal) * 100 : 0;
              return (
                <div className={styles.barGroup} key={index}>
                  <div className={styles.barValue}>{day.sent}</div>
                  <div
                    className={styles.bar}
                    style={{ height: `${height}%`, animationDelay: `${index * 100}ms` }}
                    title={`${day.date}: ${day.sent}건 발송`}
                  />
                  <div className={styles.barLabel}>{day.date}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 채널별 비율 (도넛 차트) */}
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>📊 채널별 발송 비율</div>
          <div className={styles.donutChart}>
            <div
              className={styles.donutVisual}
              style={{
                background: `conic-gradient(
                  #fee500 0% ${channelTotal > 0 ? (stats.channelStats.kakao / channelTotal) * 100 : 50}%,
                  #60a5fa ${channelTotal > 0 ? (stats.channelStats.kakao / channelTotal) * 100 : 50}% 100%
                )`,
              }}
            >
              <div className={styles.donutCenter}>
                <div className={styles.donutTotal}>{channelTotal}</div>
                <div className={styles.donutTotalLabel}>전체 발송</div>
              </div>
            </div>
            <div className={styles.donutLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendDot} style={{ background: "#fee500" }} />
                <span className={styles.legendLabel}>카카오톡</span>
                <span className={styles.legendValue}>{stats.channelStats.kakao}건</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendDot} style={{ background: "#60a5fa" }} />
                <span className={styles.legendLabel}>SMS/MMS</span>
                <span className={styles.legendValue}>{stats.channelStats.sms}건</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 캠페인 */}
      <div className={styles.recentSection}>
        <div className={styles.recentHeader}>
          <div className={styles.recentTitle}>🕐 최근 캠페인</div>
          <a href="/campaigns" className="btn btn-secondary btn-sm">전체 보기 →</a>
        </div>
        {campaigns.slice(0, 5).map((campaign) => {
          const isKakao = campaign.channel.startsWith("kakao");
          const rate = campaign.totalCount > 0
            ? Math.round((campaign.successCount / campaign.totalCount) * 100)
            : 0;
          return (
            <div className={styles.campaignRow} key={campaign.id}>
              <div className={`${styles.campaignIcon} ${isKakao ? styles.campaignKakao : styles.campaignSms}`}>
                {isKakao ? "💬" : "📱"}
              </div>
              <div className={styles.campaignInfo}>
                <div className={styles.campaignName}>{campaign.name}</div>
                <div className={styles.campaignDate}>
                  {campaign.startedAt
                    ? new Date(campaign.startedAt).toLocaleDateString("ko-KR")
                    : campaign.scheduledAt
                    ? `예약: ${new Date(campaign.scheduledAt).toLocaleDateString("ko-KR")}`
                    : "미정"}
                </div>
              </div>
              <div>
                <span className={`badge ${
                  campaign.status === "completed" ? "badge-success" :
                  campaign.status === "sending" ? "badge-warning" :
                  campaign.status === "scheduled" ? "badge-info" : "badge-error"
                }`}>
                  {campaign.status === "completed" ? "완료" :
                   campaign.status === "sending" ? "발송 중" :
                   campaign.status === "scheduled" ? "예약됨" : "대기"}
                </span>
              </div>
              <div className={styles.campaignStats}>
                <div className={styles.campaignCount}>{campaign.totalCount.toLocaleString()}건</div>
                <div className={styles.campaignRate}>{rate}% 성공</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
