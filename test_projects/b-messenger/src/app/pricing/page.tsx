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
  const { user, refreshProfile, paymentStatus } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("free");
  const [changing, setChanging] = useState(false);
  const [toast, setToast] = useState("");
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [selectedDowngradePlanId, setSelectedDowngradePlanId] = useState("");

  // 현재 플랜 가져오기
  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("b-messenger_users")
        .select("plan, subscription_end_date")
        .eq("id", user.id)
        .single();
      if (data?.plan) setCurrentPlan(data.plan);
      if (data?.subscription_end_date) setSubscriptionEndDate(data.subscription_end_date);
    }
    load();
  }, [user]);

  const [showModal, setShowModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [depositorName, setDepositorName] = useState("");

  // 플랜 변경 버튼 클릭 시
  async function handleChangePlan(planId: string) {
    if (!user || planId === currentPlan) return;

    const selected = plans.find(p => p.id === planId);
    if (!selected) return;

    // 무료를 포함한 모든 플랜 변경은 handleSelectPlan으로 통합 처리 (다운그레이드 및 요금 계산 목적)
    handleSelectPlan(planId);
  }

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    
    // 예약 중복 차단: 이미 다운그레이드 예약이 있는지 확인
    if (paymentStatus === "downgrade_reserved") {
      alert("⚠️ 이미 다운그레이드 변경이 예약되어 있습니다.\n(예약 변경이나 취소가 필요하신 경우 관리자에게 문의하세요)");
      return;
    }

    if (currentPlan === planId) {
      alert("이미 이용 중인 요금제입니다.");
      return;
    }

    const currentPlanPrice = plans.find(p => p.id === currentPlan)?.price || 0;
    const selectedPlanPrice = plans.find(p => p.id === planId)?.price || 0;

    // 가격이 더 낮아지는 다운그레이드인지 확인
    if (currentPlanPrice > selectedPlanPrice) {
      setSelectedDowngradePlanId(planId);
      setShowDowngradeModal(true);
      return;
    }

    // 업그레이드일 경우 무통장 입금 모달 띄우기
    setSelectedPlanId(planId);
    setShowModal(true);
  };

  async function handleDowngrade(planId: string) {
    if (!user) return;
    setChanging(true);
    const { error: userError } = await supabase
      .from("b-messenger_users")
      .update({
        plan_request: planId,
        payment_status: "downgrade_reserved",
        plan_request_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (userError) {
      alert("오류가 발생했습니다: " + userError.message);
      setChanging(false);
      return;
    }

    // 다운그레이드는 입금 확인 없이 즉시 예약 로그 생성
    await supabase
      .from("b-messenger_payment_logs")
      .insert({
        user_id: user.id,
        plan_name: planId,
        amount: 0,
        depositor_name: "자동예약(다운그레이드)",
        status: "approved", // 승인 완료된 예약건
        requested_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      });

    alert(`다음 결제일부터 ${plans.find(p => p.id === planId)?.name} 요금제로 변경되도록 예약되었습니다.`);
    setChanging(false);
  }

  async function handleSubmitPayment() {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!depositorName.trim()) {
      alert("입금자명을 입력해주세요.");
      return;
    }

    setChanging(true);
    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    
    // 1. 사용자 정보에 신청 기록 업데이트
    const { error: userError } = await supabase
      .from("b-messenger_users")
      .update({
        plan_request: selectedPlanId,
        depositor_name: depositorName,
        payment_status: "pending",
        plan_request_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (userError) {
      alert("신청 중 오류가 발생했습니다: " + userError.message);
      setChanging(false);
      return;
    }

    // 2. 결제 로그(장부) 테이블에 새로운 신청 내역(pending) 인서트
    const amountNum = typeof selectedPlan?.price === 'number' ? selectedPlan.price : 0;
    const { error: logError } = await supabase
      .from("b-messenger_payment_logs")
      .insert({
        user_id: user.id,
        plan_name: selectedPlanId,
        amount: amountNum,
        depositor_name: depositorName,
        status: "pending",
        requested_at: new Date().toISOString()
      });

    if (logError) {
      console.error("결제 로그 생성 실패:", logError);
      // 로그 생성 실패가 메인 워크플로우를 중단하지 않도록 할 수도 있지만 여기선 에러 처리
    }

    alert("신청이 완료되었습니다. 관리자 확인 후 승인됩니다.");
    setDepositorName("");
    setShowModal(false);
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

      {/* 무통장 입금 모달 (화이트 테마) */}
      {showModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{ background: "#ffffff", padding: "32px", width: "400px", maxWidth: "90%", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginBottom: "16px", color: "#1e293b" }}>📝 무통장 입금 신청</h2>
            <div style={{ marginBottom: "20px", fontSize: "0.95rem", color: "#475569", lineHeight: 1.5 }}>
              <p>아래 계좌로 해당 금액을 입금해주시면, 확인 후 즉시 플랜이 업그레이드 됩니다.</p>
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", marginTop: "12px", border: "1px solid #e2e8f0", color: "#334155" }}>
                <strong>은행</strong>: 국민은행<br/>
                <strong>계좌번호</strong>: 123456-78-901234<br/>
                <strong>예금주</strong>: (주)비메신저<br/>
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #cbd5e1", color: "#2563eb", fontWeight: 700 }}>
                  결제 금액: {plans.find(p => p.id === selectedPlanId)?.priceLabel}
                </div>
              </div>
            </div>
            
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "#475569", fontWeight: 600 }}>입금자명 (실제 입금하실 이름)</label>
              <input 
                type="text" 
                value={depositorName} 
                onChange={e => setDepositorName(e.target.value)}
                placeholder="반드시 입금자명을 입력해주세요"
                style={{
                  width: "100%", padding: "12px", borderRadius: "8px",
                  background: "#ffffff", border: "1px solid #cbd5e1",
                  color: "#0f172a", outline: "none",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)"
                }}
              />
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setShowModal(false)}
                disabled={changing}
                style={{ flex: 1, padding: "12px", background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#475569", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
              >
                취소
              </button>
              <button 
                onClick={handleSubmitPayment}
                disabled={changing}
                style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", color: "white", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}
              >
                {changing ? "처리 중..." : "입금 완료 및 신청"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 프리미엄 다운그레이드 예약 모달 */}
      {showDowngradeModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(6px)"
        }}>
          <div style={{ background: "rgba(30, 41, 59, 0.95)", border: "1px solid rgba(255,255,255,0.1)", padding: "32px", width: "450px", maxWidth: "90%", borderRadius: "20px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "800", marginBottom: "16px", color: "white", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🗓️</span> 다운그레이드 예약 신청 
            </h2>
            <div style={{ marginBottom: "24px", fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.6 }}>
              <p>현재 요금제의 남은 혜택을 100% 보장해 드리기 위해, 즉시 변경되지 않고 <strong style={{color:"#f8fafc"}}>다음 구독 결제일</strong>부터 새로운 요금제가 시작됩니다.</p>
              
              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "20px", borderRadius: "14px", marginTop: "16px", border: "1px solid rgba(255,255,255,0.05)", color: "#e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ color: "#64748b" }}>현재 이용 중</span>
                  <span style={{ fontWeight: 600 }}>{plans.find(p => p.id === currentPlan)?.name} ({plans.find(p => p.id === currentPlan)?.priceLabel})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ color: "#64748b" }}>변경 신청 플랜</span>
                  <span style={{ fontWeight: 600, color: "#cbd5e1" }}>{plans.find(p => p.id === selectedDowngradePlanId)?.name} ({plans.find(p => p.id === selectedDowngradePlanId)?.priceLabel})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "10px", marginTop: "4px" }}>
                  <span style={{ color: "#64748b" }}>요금제 변경 예정일</span>
                  <span style={{ fontWeight: 700, color: "#38bdf8" }}>
                    {subscriptionEndDate 
                      ? new Date(subscriptionEndDate).toLocaleDateString()
                      : "다음 정기 결제일"}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(239, 68, 68, 0.2)", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "0.9rem", color: "#fca5a5", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⚠️</span> 다운그레이드 유의사항
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "#f87171", lineHeight: 1.5 }}>
                <li>변경 예정일 전까지는 기존의 높은 혜택이 그대로 유지됩니다.</li>
                <li>변경 시점에 초과 생성된 주소록 명단은 가장 아래부터 순차 접근이 임시 제한될 수 있습니다.</li>
              </ul>
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setShowDowngradeModal(false)}
                disabled={changing}
                style={{ flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", borderRadius: "12px", cursor: "pointer", fontWeight: 600, transition: "all 0.2s" }}
              >
                취소
              </button>
              <button 
                onClick={() => {
                  handleDowngrade(selectedDowngradePlanId);
                  setShowDowngradeModal(false);
                }}
                disabled={changing}
                style={{ flex: 2, padding: "14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", border: "none", color: "white", borderRadius: "12px", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 15px rgba(59, 130, 246, 0.4)", transition: "all 0.2s" }}
              >
                {changing ? "예약 중..." : "예 확인했습니다 (예약)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
