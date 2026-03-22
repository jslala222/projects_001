// ================================================================
// PlanGate.tsx — 플랜 잠금 게이트 컴포넌트
// 특정 플랜 이상일 때만 자식 콘텐츠를 보여주고,
// 그 미만이면 업그레이드 배너를 렌더링합니다.
// ================================================================
"use client";

import React from "react";
import Link from "next/link";
import { usePlan, PlanType } from "@/hooks/usePlan";

interface PlanGateProps {
  /** 접근하려면 최소 이 플랜 이상이어야 함 (보통 "pro") */
  require: PlanType;
  /** 잠긴 기능 이름 (업그레이드 메시지에 표시) */
  feature: string;
  children: React.ReactNode;
}

const PLAN_LABELS: Record<PlanType, string> = {
  free: "FREE",
  pro: "PRO",
  enterprise: "ENTERPRISE",
};

const PLAN_COLORS: Record<PlanType, string> = {
  free: "#6b7280",
  pro: "#7c3aed",
  enterprise: "#0ea5e9",
};

export function PlanGate({ require, feature, children }: PlanGateProps) {
  const { plan, isAtLeast } = usePlan();

  if (isAtLeast(require)) {
    return <>{children}</>;
  }

  const requiredLabel = PLAN_LABELS[require];
  const requiredColor = PLAN_COLORS[require];
  const currentLabel = PLAN_LABELS[plan];

  return (
    <div style={{ padding: "24px 32px" }}>
      <div
        style={{
          textAlign: "center",
          padding: "80px 24px",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        {/* 자물쇠 아이콘 */}
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>

        {/* 기능명 + 플랜 뱃지 */}
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
          {feature}
        </h2>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
          이 기능은{" "}
          <span
            style={{
              fontWeight: 700,
              color: requiredColor,
              background: `${requiredColor}18`,
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "13px",
            }}
          >
            {requiredLabel}
          </span>{" "}
          이상 플랜에서 사용할 수 있습니다.
          <br />
          현재 플랜:{" "}
          <span style={{ fontWeight: 600, color: "#374151" }}>{currentLabel}</span>
        </p>

        {/* 업그레이드 버튼 */}
        <Link
          href="/pricing"
          style={{
            display: "inline-block",
            padding: "10px 28px",
            background: requiredColor,
            color: "#ffffff",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          플랜 업그레이드 →
        </Link>
      </div>
    </div>
  );
}
