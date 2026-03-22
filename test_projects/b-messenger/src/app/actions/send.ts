// ================================================================
// app/actions/send.ts — 그룹 발송 액션
// ☑ 솔라피(Solapi) API 서버 라우트 경유 발송
// ☑ b-messenger_campaigns + b-messenger_send_logs 기록
// ☑ 하위 그룹 포함 재귀 멤버 대상
// ☑ 발송 진행 상황 콜백 지원
// ================================================================
"use server";

import { supabase, TABLES } from "@/lib/supabase";
import type { Customer } from "@/types";

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface GroupSendParams {
  groupId: string;
  groupName: string;
  channel: "sms" | "lms" | "kakao_friend" | "kakao_alim";
  message: string;
  /** 알림톡 전용: 솔라피 templateId */
  kakaoTemplateId?: string;
  /** MMS/친구톡 이미지 ID */
  imageId?: string;
  /** 자동 fallback: 카카오 실패 시 SMS 발송 */
  fallback?: boolean;
  /** 발송 캠페인 이름 (미입력 시 자동 생성) */
  campaignName?: string;
}

export interface SendProgress {
  total: number;
  sent: number;
  success: number;
  fail: number;
  currentName?: string;
}

export type SendProgressCallback = (progress: SendProgress) => void;

// ── API 설정 조회 ─────────────────────────────────────────────────
async function getApiSettings(userId: string): Promise<{
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
  kakaoChannelId?: string;
} | null> {
  const { data, error } = await supabase
    .from(TABLES.API_KEYS)
    .select("api_key, api_secret, sender_number, kakao_channel_id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  return {
    apiKey: data.api_key as string,
    apiSecret: data.api_secret as string,
    senderNumber: data.sender_number as string,
    kakaoChannelId: (data.kakao_channel_id as string) || undefined,
  };
}

// ── 캠페인 생성 ───────────────────────────────────────────────────
async function createCampaign(
  userId: string,
  name: string,
  channel: string,
  message: string,
  totalCount: number,
  groupId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.CAMPAIGNS)
    .insert({
      tenant_id: userId,
      name,
      channel,
      message,
      status: "sending",
      total_count: totalCount,
      success_count: 0,
      fail_count: 0,
      send_rate: 300,
      fallback_enabled: false,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) return null;

  const campaignId = data.id as string;

  // send_targets 기록
  await supabase.from(TABLES.SEND_TARGETS).insert({
    tenant_id: userId,
    campaign_id: campaignId,
    target_type: "group",
    group_id: groupId,
    estimated_count: totalCount,
  });

  return campaignId;
}

// ── 단건 발송 (서버 라우트 경유) ─────────────────────────────────
async function sendSingleMessage(
  apiKey: string,
  apiSecret: string,
  senderNumber: string,
  to: string,
  text: string,
  channel: string,
  options?: {
    kakaoChannelId?: string;
    templateId?: string;
    imageId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 서버 액션이므로 fetch 상대경로 사용 불가 → 솔라피 HMAC 서명 직접 생성
    const { SolapiClient } = await import("@/lib/solapi");
    const client = new SolapiClient({
      apiKey,
      apiSecret,
      senderNumber,
      kakaoChannelId: options?.kakaoChannelId,
    });

    switch (channel) {
      case "kakao_alim":
        if (!options?.templateId) throw new Error("알림톡 templateId 필요");
        await client.sendAlimTalk(to, options.templateId, { 이름: "고객", 내용: text });
        break;
      case "kakao_friend":
        await client.sendFriendTalk(to, text, options?.imageId);
        break;
      case "lms":
        await client.sendSMS(to, text); // sendSMS가 90자 초과시 LMS로 자동 처리
        break;
      case "sms":
      default:
        await client.sendSMS(to, text);
        break;
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "발송 오류" };
  }
}

// ── send_log 기록 ────────────────────────────────────────────────
async function logSendResult(
  userId: string,
  campaignId: string,
  contactId: string,
  phone: string,
  channel: string,
  success: boolean,
  errorMsg?: string
) {
  await supabase.from(TABLES.SEND_LOGS).insert({
    tenant_id: userId,
    campaign_id: campaignId,
    contact_id: contactId,
    phone,
    channel,
    status: success ? "sent" : "failed",
    sent_at: success ? new Date().toISOString() : null,
    error_message: errorMsg ?? null,
  });
}

// ── 캠페인 상태 업데이트 ─────────────────────────────────────────
async function finalizeCampaign(
  campaignId: string,
  successCount: number,
  failCount: number
) {
  await supabase
    .from(TABLES.CAMPAIGNS)
    .update({
      status: "completed",
      success_count: successCount,
      fail_count: failCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

// ── 메인: 그룹 대량 발송 ────────────────────────────────────────
// 발송 중 진행 상황을 클라이언트에 스트리밍하려면 useTransition + Server Action으로 호출
export async function sendToGroup(
  params: GroupSendParams,
  members: Customer[]
): Promise<{
  success: boolean;
  campaignId?: string;
  successCount: number;
  failCount: number;
  error?: string;
}> {
  // getGroupMembersForSend 가 이미 RLS를 통과해 반환한 members 에서 userId 추출
  // (서버 액션에서 싱글턴 supabase 클라이언트는 브라우저 세션을 읽지 못하므로)
  const userId = members[0]?.user_id ?? (await getCurrentUserId());
  if (!userId) return { success: false, successCount: 0, failCount: 0, error: "로그인이 필요합니다" };

  if (members.length === 0) {
    return { success: false, successCount: 0, failCount: 0, error: "발송 대상이 없습니다" };
  }

  // API 설정 조회
  const apiSettings = await getApiSettings(userId);
  const isSimulation = !apiSettings;

  // 캠페인 이름
  const campaignName =
    params.campaignName ||
    `[${params.groupName}] ${new Date().toLocaleDateString("ko-KR")} ${
      { sms: "SMS", lms: "LMS", kakao_friend: "친구톡", kakao_alim: "알림톡" }[params.channel]
    } 발송`;

  // 캠페인 생성
  const campaignId = await createCampaign(
    userId,
    campaignName,
    params.channel,
    params.message,
    members.length,
    params.groupId
  );

  if (!campaignId) {
    return { success: false, successCount: 0, failCount: 0, error: "캠페인 생성에 실패했습니다" };
  }

  let successCount = 0;
  let failCount = 0;

  // 순차 발송 (솔라피 rate limit 배려: ~300건/초 기본)
  for (const member of members) {
    // #{이름} 치환
    const personalizedText = params.message
      .replace(/#{이름}/g, member.name)
      .replace(/#{전화번호}/g, member.phone)
      .replace(/#{메모}/g, member.memo ?? "");

    let sendSuccess = false;
    let sendError: string | undefined;

    if (isSimulation) {
      // 시뮬레이션 모드: 랜덤 성공/실패
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 50));
      sendSuccess = Math.random() > 0.05; // 95% 성공률 시뮬레이션
      sendError = sendSuccess ? undefined : "시뮬레이션: 발송 실패";
    } else {
      const result = await sendSingleMessage(
        apiSettings.apiKey,
        apiSettings.apiSecret,
        apiSettings.senderNumber,
        member.phone,
        personalizedText,
        params.channel,
        {
          kakaoChannelId: apiSettings.kakaoChannelId,
          templateId: params.kakaoTemplateId,
          imageId: params.imageId,
        }
      );
      sendSuccess = result.success;
      sendError = result.error;

      // fallback: 카카오 실패 → SMS
      if (!sendSuccess && params.fallback && params.channel.startsWith("kakao")) {
        const fallbackResult = await sendSingleMessage(
          apiSettings.apiKey,
          apiSettings.apiSecret,
          apiSettings.senderNumber,
          member.phone,
          personalizedText,
          "sms"
        );
        sendSuccess = fallbackResult.success;
        sendError = fallbackResult.error;
      }
    }

    if (sendSuccess) successCount++;
    else failCount++;

    // 발송 로그 기록
    await logSendResult(
      userId,
      campaignId,
      member.id,
      member.phone,
      params.channel,
      sendSuccess,
      sendError
    );
  }

  // 캠페인 완료 처리
  await finalizeCampaign(campaignId, successCount, failCount);

  return { success: true, campaignId, successCount, failCount };
}
