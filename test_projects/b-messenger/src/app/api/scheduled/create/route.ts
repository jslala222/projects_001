// ================================================================
// api/scheduled/create/route.ts — 예약 발송 등록
// POST { title, message, channel, recipients, scheduled_at }
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/supabase";
import { formatKSTDate } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { title, message, channel, recipients, scheduled_at } = await req.json();

    if (!title || !message || !channel || !recipients?.length || !scheduled_at) {
      return NextResponse.json(
        { success: false, message: "필수 항목이 누락되었습니다." },
        { status: 400 }
      );
    }

    if (new Date(scheduled_at) <= new Date()) {
      return NextResponse.json(
        { success: false, message: "예약 시간은 현재 시간 이후로 설정해주세요." },
        { status: 400 }
      );
    }

    // 인증된 사용자 확인 (서버 사이드 클라이언트)
    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseServer.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseServer
      .from(TABLES.SCHEDULED_SENDS)
      .insert({
        user_id: userId,
        title,
        message,
        channel,
        recipients,
        scheduled_at,
        status: "pending",
        created_at: formatKSTDate(new Date()),
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "예약 발송이 등록되었습니다.",
      id: data.id,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { success: false, message: `등록 실패: ${msg}` },
      { status: 500 }
    );
  }
}
