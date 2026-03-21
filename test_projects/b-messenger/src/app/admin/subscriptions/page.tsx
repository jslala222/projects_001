"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { PaymentLog, UserProfile } from "@/types";

export default function AdminSubscriptionsClient() {
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const loadLogs = async () => {
    setLoading(true);
    // 1. Fetch payment logs
    const { data: logData, error: logError } = await supabase
      .from("b-messenger_payment_logs")
      .select("*")
      .order("requested_at", { ascending: false });

    // 2. Fetch users to map email/current plan manually (safest way without assuming PK relations)
    const { data: userData } = await supabase
      .from("b-messenger_users")
      .select("*");

    if (!logError && logData) {
      const merged: PaymentLog[] = logData.map(log => {
        const user = userData?.find(u => u.id === log.user_id);
        return {
          ...log,
          user: user as UserProfile
        };
      });
      setLogs(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [activeTab]); // tab 바꿀 때마다 리로드해도 되고 안해도 됨

  const handleApprove = async (log: PaymentLog) => {
    if (!log.user) return;
    if (!confirm(`${log.user.email} 님의 ${log.plan_name} 플랜 결제를 승인하고 로그를 저장하시겠습니까?`)) return;

    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // 1개월 뒤 만료

    // 1. Update log
    const { error: logError } = await supabase
      .from("b-messenger_payment_logs")
      .update({
        status: "approved",
        processed_at: now.toISOString(),
        start_date: now.toISOString(),
        end_date: endDate.toISOString()
      })
      .eq("id", log.id);

    // 2. Update user
    if (!logError) {
      const { error: userError } = await supabase
        .from("b-messenger_users")
        .update({
          plan: log.plan_name,
          payment_status: "completed",
          plan_request: null,
          plan_request_at: null
        })
        .eq("id", log.user_id);

      if (!userError) {
        setToast("✅ 결제 승인 및 장부 기록 완료");
        setTimeout(() => setToast(""), 3000);
        loadLogs();
      }
    } else {
      setToast("❌ 승인 실패: " + logError.message);
      setTimeout(() => setToast(""), 3000);
    }
  };

  const handleReject = async (log: PaymentLog) => {
    if (!log.user) return;
    if (!confirm(`${log.user.email} 님의 결제를 취소/거절하시겠습니까?`)) return;

    const now = new Date().toISOString();

    const { error: logError } = await supabase
      .from("b-messenger_payment_logs")
      .update({
        status: "rejected",
        processed_at: now
      })
      .eq("id", log.id);

    if (!logError) {
      await supabase
        .from("b-messenger_users")
        .update({
          payment_status: "failed",
          plan_request: null,
          plan_request_at: null
        })
        .eq("id", log.user_id);

      setToast("✅ 취소 및 기록 완료");
      setTimeout(() => setToast(""), 3000);
      loadLogs();
    }
  };

  const pendingLogs = logs.filter(l => l.status === "pending");
  const historyLogs = logs.filter(l => l.status !== "pending");

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div style={{ padding: "2rem", width: "100%", maxWidth: "1200px", margin: "0 auto", animation: "slideInUp 400ms ease both" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "2rem" }}>💳 구독 및 결제 관리 (관리자)</h1>
      
      {toast && (
        <div style={{ padding: "12px 20px", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", borderRadius: "8px", marginBottom: "1rem", backdropFilter: "blur(10px)" }}>
          {toast}
        </div>
      )}

      {/* 탭 네비게이션 (알약형 디자인) */}
      <div style={{
        display: "inline-flex",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "9999px",
        padding: "6px",
        marginBottom: "24px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <button
          onClick={() => setActiveTab("pending")}
          style={{
            background: activeTab === "pending" ? "#2563eb" : "transparent",
            color: activeTab === "pending" ? "#ffffff" : "var(--text-secondary)",
            border: "none",
            borderRadius: "9999px",
            padding: "10px 24px",
            fontSize: "1.05rem",
            fontWeight: activeTab === "pending" ? "600" : "500",
            cursor: "pointer",
            transition: "all 0.3s outline",
            boxShadow: activeTab === "pending" ? "0 4px 12px rgba(37,99,235,0.4)" : "none"
          }}
        >
          승인 대기열 ({pendingLogs.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={{
            background: activeTab === "history" ? "#2563eb" : "transparent",
            color: activeTab === "history" ? "#ffffff" : "var(--text-secondary)",
            border: "none",
            borderRadius: "9999px",
            padding: "10px 24px",
            fontSize: "1.05rem",
            fontWeight: activeTab === "history" ? "600" : "500",
            cursor: "pointer",
            transition: "all 0.3s outline",
            boxShadow: activeTab === "history" ? "0 4px 12px rgba(37,99,235,0.4)" : "none"
          }}
        >
          전체 결제/구독 내역
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          데이터를 불러오는 중입니다...
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid var(--border-primary)" }}>
                <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>사용자 (이메일)</th>
                <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>신청 일시</th>
                <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>신청 플랜</th>
                <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>결제 금액</th>
                <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>입금자명</th>
                <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>상태/처리일</th>
                {activeTab === "pending" && (
                  <th style={{ padding: "16px", fontWeight: "600", color: "var(--text-secondary)", textAlign: "right" }}>결제 처리</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(activeTab === "pending" ? pendingLogs : historyLogs).length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                    {activeTab === "pending" ? "현재 결제/승인 대기 중인 내역이 없습니다." : "과거 결제 및 구독 내역이 없습니다."}
                  </td>
                </tr>
              ) : (
                (activeTab === "pending" ? pendingLogs : historyLogs).map(l => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border-primary)", transition: "background 0.2s" }} className="hover:bg-white/5">
                    <td style={{ padding: "16px", color: "var(--text-primary)" }}>
                      {l.user?.email || "알 수 없음"}<br/>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px", display: "inline-block" }}>
                        (현재: {l.user?.plan || "free"})
                      </span>
                    </td>
                    <td style={{ padding: "16px", color: "var(--text-primary)", fontSize: "0.9rem" }}>
                      {formatDate(l.requested_at)}
                    </td>
                    <td style={{ padding: "16px", fontWeight: "bold", color: "#60a5fa" }}>{l.plan_name}</td>
                    <td style={{ padding: "16px" }}>{l.amount.toLocaleString()}원</td>
                    <td style={{ padding: "16px", color: "var(--text-primary)" }}>{l.depositor_name || "-"}</td>
                    <td style={{ padding: "16px" }}>
                      {l.status === "pending" ? (
                        <span style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                          ⏳ 대기중
                        </span>
                      ) : l.status === "approved" ? (
                        <div>
                          <span style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                            ✅ 승인됨
                          </span>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "8px" }}>
                            시작: {formatDate(l.start_date)}<br/>만료: {formatDate(l.end_date)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: 600, backgroundColor: "rgba(248, 113, 113, 0.15)", color: "#f87171" }}>
                            ❌ 거절/취소
                          </span>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "8px" }}>
                            처리일: {formatDate(l.processed_at)}
                          </div>
                        </div>
                      )}
                    </td>
                    {activeTab === "pending" && (
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <button 
                          onClick={() => handleApprove(l)}
                          style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", marginRight: "8px", fontWeight: 600, boxShadow: "0 4px 12px rgba(59,130,246,0.2)" }}
                        >
                          ✅ 결제 승인
                        </button>
                        <button 
                          onClick={() => handleReject(l)}
                          style={{ background: "transparent", color: "#f87171", padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer", fontWeight: 600 }}
                        >
                          취소
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
