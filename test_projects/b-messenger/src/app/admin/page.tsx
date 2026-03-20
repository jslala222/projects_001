// ================================================================
// admin/page.tsx — 관리자 전용 페이지
// 비유: "사장님 전용 사무실" — 회원 관리, 승인, 플랜 변경
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthContext";
import { supabase } from "@/lib/supabase";

// 사용자 타입
interface MemberRow {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  plan: string;
  status: string;
  created_at: string;
}

const statusLabels: Record<string, { label: string; color: string; emoji: string }> = {
  pending: { label: "승인 대기", color: "#f59e0b", emoji: "⏳" },
  approved: { label: "승인됨", color: "#10b981", emoji: "✅" },
  rejected: { label: "거부됨", color: "#ef4444", emoji: "🚫" },
};

const planLabels: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "#94a3b8" },
  pro: { label: "Pro", color: "#667eea" },
  enterprise: { label: "Enterprise", color: "#764ba2" },
};

export default function AdminPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // 관리자 권한 확인 + 회원 목록 로드
  useEffect(() => {
    async function load() {
      if (!user) return;

      // 현재 사용자의 역할 확인
      const { data: me } = await supabase
        .from("b-messenger_users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (me?.role === "admin") {
        setIsAdmin(true);
        await loadMembers();
      }
      setLoading(false);
    }
    load();
  }, [user]);

  async function loadMembers() {
    const { data } = await supabase
      .from("b-messenger_users")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMembers(data as MemberRow[]);
  }

  // 승인 상태 변경
  async function updateStatus(memberId: string, newStatus: string) {
    const { error } = await supabase
      .from("b-messenger_users")
      .update({ status: newStatus })
      .eq("id", memberId);

    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: newStatus } : m));
      showToast(`${newStatus === "approved" ? "✅ 승인" : "🚫 거부"} 처리되었습니다.`);
    }
  }

  // 플랜 변경
  async function updatePlan(memberId: string, newPlan: string) {
    const { error } = await supabase
      .from("b-messenger_users")
      .update({ plan: newPlan })
      .eq("id", memberId);

    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, plan: newPlan } : m));
      showToast(`💎 플랜이 ${planLabels[newPlan]?.label || newPlan}(으)로 변경되었습니다.`);
    }
  }

  // 역할 변경
  async function updateRole(memberId: string, newRole: string) {
    const { error } = await supabase
      .from("b-messenger_users")
      .update({ role: newRole })
      .eq("id", memberId);

    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      showToast(`🔑 역할이 ${newRole === "admin" ? "관리자" : "일반 사용자"}로 변경되었습니다.`);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // 필터링
  const filteredMembers = filter === "all"
    ? members
    : members.filter(m => m.status === filter);

  const pendingCount = members.filter(m => m.status === "pending").length;

  // 로딩
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
        ⏳ 로딩 중...
      </div>
    );
  }

  // 권한 없음
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>접근 권한이 없습니다</h2>
        <p style={{ color: "var(--text-secondary)" }}>관리자만 이 페이지에 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div style={{ animation: "slideInUp 400ms ease both" }}>
      {/* 토스트 */}
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

      {/* 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🛡️ 관리자 페이지</h1>
          <p className="page-subtitle">회원 관리 · 승인 · 요금제 변경</p>
        </div>
        <button className="btn btn-secondary" onClick={loadMembers}>🔄 새로고침</button>
      </div>

      {/* 통계 카드 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16, marginBottom: 24,
      }}>
        <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--brand-primary)" }}>{members.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>전체 회원</div>
        </div>
        <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>{pendingCount}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>승인 대기</div>
        </div>
        <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981" }}>
            {members.filter(m => m.status === "approved").length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>승인됨</div>
        </div>
        <div className="glass-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#667eea" }}>
            {members.filter(m => m.plan === "pro" || m.plan === "enterprise").length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>유료 회원</div>
        </div>
      </div>

      {/* 필터 탭 */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 20,
        background: "var(--bg-glass)", borderRadius: 12,
        padding: 4, border: "1px solid var(--border-primary)",
        width: "fit-content",
      }}>
        {[
          { key: "all", label: "전체", count: members.length },
          { key: "pending", label: "⏳ 대기", count: pendingCount },
          { key: "approved", label: "✅ 승인", count: members.filter(m => m.status === "approved").length },
          { key: "rejected", label: "🚫 거부", count: members.filter(m => m.status === "rejected").length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              cursor: "pointer", fontWeight: 600, fontSize: 13,
              background: filter === tab.key ? "var(--brand-primary)" : "transparent",
              color: filter === tab.key ? "#fff" : "var(--text-secondary)",
              transition: "all 200ms",
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* 회원 목록 */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
              {["이름", "이메일", "휴대폰", "역할", "플랜", "상태", "가입일", "관리"].map(h => (
                <th key={h} style={{
                  padding: "14px 16px", textAlign: "left",
                  fontSize: 12, fontWeight: 700,
                  color: "var(--text-muted)", textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map(member => {
              const st = statusLabels[member.status] || statusLabels.pending;
              const pl = planLabels[member.plan] || planLabels.free;
              return (
                <tr key={member.id} style={{
                  borderBottom: "1px solid var(--border-primary)",
                  transition: "background 200ms",
                }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>
                    {member.name || "—"}
                    {member.role === "admin" && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, padding: "2px 6px",
                        borderRadius: 4, background: "rgba(102,126,234,0.15)",
                        color: "#667eea", fontWeight: 700,
                      }}>관리자</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                    {member.email}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                    {member.phone || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={member.role}
                      onChange={(e) => updateRole(member.id, e.target.value)}
                      style={{
                        padding: "4px 8px", borderRadius: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-glass)", color: "var(--text-primary)",
                        fontSize: 12, cursor: "pointer",
                      }}
                    >
                      <option value="user">일반</option>
                      <option value="admin">관리자</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <select
                      value={member.plan}
                      onChange={(e) => updatePlan(member.id, e.target.value)}
                      style={{
                        padding: "4px 8px", borderRadius: 6,
                        border: `1px solid ${pl.color}44`,
                        background: `${pl.color}15`, color: pl.color,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "4px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: `${st.color}15`, color: st.color,
                      border: `1px solid ${st.color}33`,
                    }}>
                      {st.emoji} {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(member.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {member.status !== "approved" && (
                        <button
                          onClick={() => updateStatus(member.id, "approved")}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: "none",
                            background: "rgba(16,185,129,0.15)", color: "#10b981",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >✅ 승인</button>
                      )}
                      {member.status !== "rejected" && member.role !== "admin" && (
                        <button
                          onClick={() => updateStatus(member.id, "rejected")}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: "none",
                            background: "rgba(239,68,68,0.1)", color: "#ef4444",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}
                        >🚫 거부</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={8} style={{
                  padding: 40, textAlign: "center",
                  color: "var(--text-muted)", fontSize: 14,
                }}>
                  {filter === "all" ? "아직 가입한 회원이 없습니다." : "해당 상태의 회원이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
