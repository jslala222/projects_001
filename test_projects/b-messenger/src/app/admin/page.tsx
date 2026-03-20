"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 관리자가 아니면 대시보드로 강제 이동
    if (!isAdmin && user) {
      router.replace("/");
    } else if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, user, router]);

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase.from("b-messenger_users").select("*").order("created_at", { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }

  async function handleStatusChange(id: string, currentStatus: string) {
    const newStatus = currentStatus === "approved" ? "pending" : "approved";
    await supabase.from("b-messenger_users").update({ status: newStatus }).eq("id", id);
    fetchUsers();
  }

  async function handleRoleChange(id: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await supabase.from("b-messenger_users").update({ role: newRole }).eq("id", id);
    fetchUsers();
  }

  if (!isAdmin) return null;

  return (
    <div style={{ animation: "slideInUp 400ms ease both", padding: 8 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛡️ 회원 관리 (관리자)</h1>
          <p className="page-subtitle">가입한 사용자들의 승인 상태 및 권한을 관리합니다.</p>
        </div>
      </div>
      
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
          사용자 목록을 불러오는 중...
        </div>
      ) : (
        <div className="glass-card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-primary)", background: "rgba(255,255,255,0.02)" }}>
                <th style={{ padding: "16px 20px", fontWeight: 600 }}>아이디 (이메일)</th>
                <th style={{ padding: "16px 20px", fontWeight: 600 }}>가입자명</th>
                <th style={{ padding: "16px 20px", fontWeight: 600 }}>상태</th>
                <th style={{ padding: "16px 20px", fontWeight: 600 }}>권한</th>
                <th style={{ padding: "16px 20px", fontWeight: 600 }}>가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                  <td style={{ padding: "16px 20px" }}>{u.email}</td>
                  <td style={{ padding: "16px 20px" }}>{u.name || "-"}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <button 
                      onClick={() => handleStatusChange(u.id, u.status)}
                      className={`badge ${u.status === "approved" ? "badge-success" : "badge-error"}`}
                      style={{ cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: u.status === "approved" ? "#34d399" : "#f87171" }}
                    >
                      {u.status === "approved" ? "✅ 승인됨" : "⛔ 대기중 (클릭하여 승인)"}
                    </button>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <button 
                      onClick={() => handleRoleChange(u.id, u.role)}
                      className="badge"
                      style={{ 
                        cursor: "pointer", 
                        border: "1px solid rgba(255,255,255,0.1)", 
                        background: u.role === "admin" ? "rgba(16,185,129,0.1)" : "transparent",
                        color: u.role === "admin" ? "#34d399" : "var(--text-secondary)"
                      }}
                    >
                      {u.role === "admin" ? "👑 최고 관리자" : "👤 일반 사용자"}
                    </button>
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--text-secondary)" }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
              가입된 사용자가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
