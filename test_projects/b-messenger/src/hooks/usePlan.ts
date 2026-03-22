// ================================================================
// usePlan.ts — 플랜별 기능 제한 훅
// PLAN_DESIGN.md 기준 FREE / PRO / ENTERPRISE 제한 정의
// ================================================================
import { useAuth } from "@/components/AuthContext";

export type PlanType = "free" | "pro" | "enterprise";

export interface PlanLimits {
  /** 주소록 저장 가능한 최대 연락처 수 */
  maxContacts: number;
  /** 최대 주소록 탭(그룹 루트) 수 */
  maxAddressBooks: number;
  /** 최대 그룹 생성 수 (0 = 그룹 기능 비활성) */
  maxGroups: number;
  /** 최대 그룹 중첩 depth */
  maxGroupDepth: number;
  /** 최대 템플릿 수 (0 = 템플릿 기능 비활성) */
  maxTemplates: number;
  /** CSV 가져오기 허용 여부 */
  csvUpload: boolean;
  /** 고객 관리 페이지(/customers) 접근 여부 */
  customerManagement: boolean;
  /** 그룹 관리 페이지(/groups) 접근 여부 */
  groupManagement: boolean;
  /** 템플릿 관리 페이지(/templates) 접근 여부 */
  templateManagement: boolean;
  /** 카카오 채널(알림톡/친구톡) 사용 여부 */
  kakaoChannels: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxContacts: 100,
    maxAddressBooks: 1,
    maxGroups: 0,
    maxGroupDepth: 0,
    maxTemplates: 0,
    csvUpload: false,
    customerManagement: false,
    groupManagement: false,
    templateManagement: false,
    kakaoChannels: false,
  },
  pro: {
    maxContacts: 5000,
    maxAddressBooks: 2,
    maxGroups: 5,
    maxGroupDepth: 3,
    maxTemplates: 20,
    csvUpload: true,
    customerManagement: true,
    groupManagement: true,
    templateManagement: true,
    kakaoChannels: true,
  },
  enterprise: {
    maxContacts: Infinity,
    maxAddressBooks: 5,
    maxGroups: Infinity,
    maxGroupDepth: 4,
    maxTemplates: Infinity,
    csvUpload: true,
    customerManagement: true,
    groupManagement: true,
    templateManagement: true,
    kakaoChannels: true,
  },
};

const PLAN_ORDER: Record<PlanType, number> = { free: 0, pro: 1, enterprise: 2 };

export function usePlan() {
  const { plan, isAdmin } = useAuth();

  // 관리자는 enterprise 권한
  const currentPlan: PlanType = isAdmin
    ? "enterprise"
    : ((plan as PlanType) || "free");

  const limits = PLAN_LIMITS[currentPlan];

  /**
   * 특정 기능의 boolean 허용 여부를 반환.
   * 숫자 제한인 경우 0보다 크면 true.
   */
  function can(feature: keyof PlanLimits): boolean {
    const val = limits[feature];
    if (typeof val === "boolean") return val;
    return (val as number) > 0;
  }

  /**
   * 현재 플랜이 특정 플랜 이상인지 확인.
   * 예: isAtLeast("pro") → pro 또는 enterprise이면 true
   */
  function isAtLeast(required: PlanType): boolean {
    return PLAN_ORDER[currentPlan] >= PLAN_ORDER[required];
  }

  return { plan: currentPlan, limits, can, isAtLeast };
}
