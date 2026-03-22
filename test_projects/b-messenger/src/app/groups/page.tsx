"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import GroupsClient from "@/components/groups/GroupsClient";
import { PlanGate } from "@/components/PlanGate";
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

  return (
    <PlanGate require="pro" feature="그룹 관리">
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
    </PlanGate>
  );
}
