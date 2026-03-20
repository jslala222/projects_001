// ================================================================
// pricing/page.tsx — 구독/요금제 관리 페이지
// 비유: "어떤 멤버십을 쓸지" 선택하는 화면
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { supabase } from "@/lib/supabase";

// 요금제 정의 (라이선스 모델로 개편)
const plans = [
  {
    id: "free",
    name: "Free",
    emoji: "🌱",
    price: 0,
    priceLabel: "무료",
    color: "#94a3b8",
    features: [
      "연락처 최대 100명",
      "기본 그룹 관리 (3개)",
      "모든 채널 발송 지원",
      "발송 건수 무제한 (본인 API)",
      "기본 통계 제공",
    ],
    limits: { contacts: 100, groups: 3 },
  },
  {
    id: "pro",
    name: "Pro",
    emoji: "🚀",
    price: 19000,
    priceLabel: "₩19,000/월",
    color: "#667eea",
    popular: true,
    features: [
      "연락처 최대 5,000명",
      "그룹 무제한 생성",
      "엑셀 대량 업로드 (CSV)",
      "고급 발송 통계 분석",
      "치환 변수 활용 기능",
      "발송 건수 무제한 (본인 API)",
    ],
    limits: { contacts: 5000, groups: -1 },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    emoji: "💎",
    price: 49000,
    priceLabel: "₩49,000/월",
    color: "#764ba2",
    features: [
      "연락처 무제한 저장",
      "실시간 발송 모니터링",
      "고객 관리 전용 메뉴 (⭐)",
      "전담 기술 및 API 연동 지원",
      "광고성 문자 수기 검토 지원",
      "발송 건수 무제한 (본인 API)",
    ],
    limits: { contacts: -1, groups: -1 },
  },
];

export default function PricingPage() {
  const { user, refreshProfile } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("free");
  const [changing, setChanging] = useState(false);
  const [toast, setToast] = useState("");

  // 현재 플랜 가져오기
  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("b-messenger_users")
        .select("plan")
        .eq("id", user.id)
        .single();
      if (data?.plan) setCurrentPlan(data.plan);
    }
    load();
  }, [user]);

  // 플랜 변경
  async function handleChangePlan(planId: string) {
    if (!user || planId === currentPlan) return;
    setChanging(true);

    const { error } = await supabase
      .from("b-messenger_users")
      .update({ plan: planId })
      .eq("id", user.id);

    if (!error) {
      setCurrentPlan(planId);
      // 🔥 전역 인증 컨텍스트의 플랜 정보도 갱신하여 사이드바 등에 즉시 반영
      await refreshProfile();
      
      const planName = plans.find((p) => p.id === planId)?.name || planId;
      setToast(`✅ ${planName} 플랜으로 변경되었습니다!`);
      setTimeout(() => setToast(""), 3000);
    }

    setChanging(false);
  }

  return (
    <div style={{ animation: "slideInUp 400ms ease both" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">💎 요금제</h1>
          <p className="page-subtitle">비즈니스에 맞는 플랜을 선택하세요</p>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 999,
          padding: "14px 24px", borderRadius: 14,
          background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
          color: "#34d399", fontSize: 14, fontWeight: 600,
          backdropFilter: "blur(10px)",
          animation: "slideInUp 300ms ease",
        }}>
          {toast}
        </div>
      )}

      {/* 요금제 카드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 20,
        maxWidth: 1100,
      }}>
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className="glass-card"
              style={{
                padding: 28,
                position: "relative",
                border: isCurrent ? `2px solid ${plan.color}` : undefined,
                transition: "all 300ms",
              }}
            >
              {/* 인기 배지 */}
              {plan.popular && (
                <div style={{
                  position: "absolute", top: -12, right: 20,
                  padding: "4px 14px", borderRadius: 20,
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(102,126,234,0.3)",
                }}>
                  🔥 인기
                </div>
              )}

              {/* 헤더 */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{plan.emoji}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{plan.name}</div>
                <div style={{
                  fontSize: 28, fontWeight: 800, marginTop: 8,
                  background: `linear-gradient(135deg, ${plan.color}, ${plan.color}aa)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  {plan.priceLabel}
                </div>
              </div>

              {/* 기능 목록 */}
              <div style={{ marginBottom: 24 }}>
                {plan.features.map((feature, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 0", fontSize: 14,
                    color: "var(--text-secondary)",
                    borderBottom: "1px solid var(--border-primary)",
                  }}>
                    <span style={{ color: plan.color }}>✓</span>
                    {feature}
                  </div>
                ))}
              </div>

              {/* 버튼 */}
              {isCurrent ? (
                <button
                  disabled
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 12,
                    border: `2px solid ${plan.color}`,
                    background: "transparent",
                    color: plan.color, fontSize: 14, fontWeight: 700,
                    cursor: "default",
                  }}
                >
                  ✅ 현재 플랜
                </button>
              ) : (
                <button
                  onClick={() => handleChangePlan(plan.id)}
                  disabled={changing}
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 12,
                    border: "none",
                    background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                    color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: changing ? "not-allowed" : "pointer",
                    opacity: changing ? 0.7 : 1,
                    transition: "all 200ms",
                    boxShadow: `0 4px 16px ${plan.color}33`,
                  }}
                >
                  {changing ? "⏳ 변경 중..." : plan.price === 0 ? "무료로 시작" : "플랜 선택"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 안내 */}
      <div className="glass-card" style={{ marginTop: 24, padding: 24 }}>
        <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 12 }}>📌 요금제 안내</h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}>
          <div style={{
            padding: 16, background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)",
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>💳 결제 방식</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              현재 데모 버전입니다. 실제 결제 연동은 추후 추가됩니다.
              플랜 변경 시 즉시 적용됩니다.
            </div>
          </div>
          <div style={{
            padding: 16, background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)",
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>📱 발송 비용 (별도)</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              메시지 발송 비용(SMS/카카오톡)은 솔라피 계정에서 소진됩니다. 
              자동차 대여료(라이선스)와 연료비(발송료)가 따로인 것과 같습니다.
            </div>
          </div>
          <div style={{
            padding: 16, background: "var(--bg-glass)",
            borderRadius: "var(--radius-md)", border: "1px solid var(--border-primary)",
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🔄 업/다운그레이드</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              언제든 자유롭게 플랜을 변경할 수 있습니다.
              변경 즉시 새 플랜이 적용됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
