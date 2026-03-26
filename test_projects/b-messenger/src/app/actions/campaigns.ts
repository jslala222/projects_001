// ================================================================
// app/actions/campaigns.ts — 발송 이력(캠페인) 조회 액션
// 플랜별 조회 기간 제한: FREE ❌, PRO 30일, ENTERPRISE 무제한
// ================================================================
import { supabase, TABLES } from "@/lib/supabase";

export interface CampaignSummary {
  id: string;
  name: string;
  channel: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "paused";
  totalCount: number;
  successCount: number;
  failCount: number;
  startedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CampaignLog {
  id: string;
  contactName: string;
  contactPhone: string;
  status: "pending" | "sent" | "failed" | "fallback";
  channelUsed: string;
  errorMessage: string | null;
  sentAt: string | null;
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** 캠페인(발송 이력) 목록 조회
 *  @param plan  "free" | "pro" | "enterprise"
 *  FREE → 접근 거부 (error 반환)
 *  PRO  → 최근 30일
 *  ENT  → 전체
 */
export async function getCampaigns(plan: string): Promise<{
  data: CampaignSummary[] | null;
  error?: string;
}> {
  if (plan === "free") {
    return { data: null, error: "FREE 플랜에서는 발송 이력을 조회할 수 없습니다." };
  }

  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다." };

  let query = supabase
    .from(TABLES.CAMPAIGNS)
    .select(
      "id, name, channel, status, total_count, success_count, fail_count, started_at, scheduled_at, completed_at, created_at"
    )
    .eq("tenant_id", userId)
    .order("created_at", { ascending: false });

  // PRO는 30일 제한
  if (plan === "pro") {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    query = query.gte("created_at", since.toISOString());
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };

  const campaigns: CampaignSummary[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as string,
    status: row.status as CampaignSummary["status"],
    totalCount: (row.total_count as number) ?? 0,
    successCount: (row.success_count as number) ?? 0,
    failCount: (row.fail_count as number) ?? 0,
    startedAt: (row.started_at as string) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: row.created_at as string,
  }));

  return { data: campaigns };
}

/** 특정 캠페인의 개별 발송 로그 조회 (최대 200건) */
export async function getCampaignLogs(
  campaignId: string,
  plan: string
): Promise<{ data: CampaignLog[] | null; error?: string }> {
  if (plan === "free") {
    return { data: null, error: "FREE 플랜에서는 발송 로그를 조회할 수 없습니다." };
  }

  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다." };

  // campaign이 해당 유저 것인지 확인
  const { data: campaign } = await supabase
    .from(TABLES.CAMPAIGNS)
    .select("id")
    .eq("id", campaignId)
    .eq("tenant_id", userId)
    .single();

  if (!campaign) return { data: null, error: "캠페인을 찾을 수 없습니다." };

  const { data, error } = await supabase
    .from(TABLES.SEND_LOGS)
    .select(
      "id, contact_name, contact_phone, status, channel_used, error_message, sent_at"
    )
    .eq("campaign_id", campaignId)
    .order("sent_at", { ascending: false })
    .limit(200);

  if (error) return { data: null, error: error.message };

  const logs: CampaignLog[] = (data ?? []).map((row) => ({
    id: row.id as string,
    contactName: row.contact_name as string,
    contactPhone: row.contact_phone as string,
    status: row.status as CampaignLog["status"],
    channelUsed: row.channel_used as string,
    errorMessage: (row.error_message as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
  }));

  return { data: logs };
}
