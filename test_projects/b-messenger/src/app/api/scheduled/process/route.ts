// ================================================================
// api/scheduled/process/route.ts — 예약 발송 자동 처리
// Vercel Cron이 1분마다 호출 (vercel.json 참고)
// 로컬 테스트: POST /api/scheduled/process (헤더 없이도 작동)
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSolapiClient, sendByChannel } from "@/lib/solapi";
import { TABLES } from "@/lib/supabase";
import { formatKSTDate } from "@/lib/utils";

// Cron 시크릿 (vercel.json CRON_SECRET 또는 환경변수)
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // 배포 환경에서는 시크릿 검증
  // Vercel Cron: Authorization: Bearer <CRON_SECRET>
  // Supabase pg_cron: x-cron-secret: <CRON_SECRET>
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization") ?? "";
    const xSecret = req.headers.get("x-cron-secret") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (bearerToken !== CRON_SECRET && xSecret !== CRON_SECRET) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 현재 시간 이전의 pending 건 모두 조회
  const now = new Date().toISOString();
  const { data: pendingList, error: fetchError } = await supabaseAdmin
    .from(TABLES.SCHEDULED_SENDS)
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now);

  if (fetchError) {
    return NextResponse.json({ success: false, message: fetchError.message }, { status: 500 });
  }

  if (!pendingList || pendingList.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: "처리할 예약 건 없음" });
  }

  let processed = 0;
  let failed = 0;

  for (const item of pendingList) {
    // 사용자 API 키 조회
    const { data: apiData } = await supabaseAdmin
      .from(TABLES.API_KEYS)
      .select("api_key, api_secret, sender_number, is_active")
      .eq("user_id", item.user_id)
      .eq("is_active", true)
      .single();

    if (!apiData) {
      await supabaseAdmin
        .from(TABLES.SCHEDULED_SENDS)
        .update({ status: "failed", result: { error: "API 키 없음" } })
        .eq("id", item.id);
      failed++;
      continue;
    }

    const client = createSolapiClient({
      apiKey: apiData.api_key as string,
      apiSecret: apiData.api_secret as string,
      senderNumber: apiData.sender_number as string,
    });

    const recipients: { name: string; phone: string }[] = item.recipients ?? [];
    let successCount = 0;
    let failCount = 0;
    const results: unknown[] = [];

    for (const recipient of recipients) {
      try {
        const result = await sendByChannel(
          client,
          item.channel,
          recipient.phone,
          item.message
        );
        successCount++;
        results.push({ phone: recipient.phone, success: true, result });
      } catch (err) {
        failCount++;
        results.push({
          phone: recipient.phone,
          success: false,
          error: err instanceof Error ? err.message : "발송 실패",
        });
      }
    }

    await supabaseAdmin
      .from(TABLES.SCHEDULED_SENDS)
      .update({
        status: failCount === recipients.length ? "failed" : "sent",
        sent_at: formatKSTDate(new Date()),
        success_count: successCount,
        fail_count: failCount,
        result: results,
      })
      .eq("id", item.id);

    processed++;
  }

  return NextResponse.json({
    success: true,
    processed,
    failed,
    message: `${processed}건 처리 완료, ${failed}건 실패`,
  });
}
