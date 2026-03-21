"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import GroupsClient from "@/components/groups/GroupsClient";
import { Toaster } from "sonner";
import { getGroups } from "@/app/actions/groups";
import type { Group } from "@/types";

export default function GroupsPage() {
  const { plan, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    getGroups().then(({ data }) => {
      setGroups(data ?? []);
      setLoaded(true);
    });
  }, [authLoading]);

  // 유료 플랜 잠금: free 플랜은 그룹 관리 불가
  if (!authLoading && plan === "free") {
    return (
      <div style={{ padding: "24px 32px" }}>
        <div style={{
          textAlign: "center",
          padding: "80px 24px",
          background: "var(--bg-card)",
          borderRadius: 16,
          border: "1px solid var(--border-light)",
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>그룹 관리는 유료 플랜 전용</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.7 }}>
            연락처를 그룹으로 분류하고 정밀 타겟팅하려면<br />
            <strong>Pro 플랜</strong> 이상으로 업그레이드하세요.
          </p>
          <ul style={{ textAlign: "left", display: "inline-block", marginBottom: 28, color: "var(--text-secondary)", fontSize: 14 }}>
            <li style={{ marginBottom: 6 }}>✅ Pro — 그룹 최대 20개, 태그 50개</li>
            <li style={{ marginBottom: 6 }}>✅ Enterprise — 그룹/태그 무제한</li>
          </ul>
          <br />
          <a
            href="/pricing"
            style={{
              display: "inline-block",
              padding: "10px 28px",
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            요금제 업그레이드 →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <Toaster richColors position="top-right" />
      {loaded && (
        <GroupsClient
          initialGroups={groups}
          plan={plan}
          onRefresh={() =>
            getGroups().then(({ data }) => setGroups(data ?? []))
          }
        />
      )}
      {!loaded && !authLoading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
          불러오는 중...
        </div>
      )}
    </div>
  );
}
