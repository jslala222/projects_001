// ================================================================
// api/scheduled/cancel/route.ts — 예약 발송 취소
// POST { id }
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, message: "id가 필요합니다." },
        { status: 400 }
      );
    }

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

    // pending 상태인 경우에만 취소 허용
    const { data: existing } = await supabaseServer
      .from(TABLES.SCHEDULED_SENDS)
      .select("status, user_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "예약 건을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existing.user_id !== userId) {
      return NextResponse.json(
        { success: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { success: false, message: "대기 중인 예약만 취소할 수 있습니다." },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from(TABLES.SCHEDULED_SENDS)
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "예약이 취소되었습니다." });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { success: false, message: `취소 실패: ${msg}` },
      { status: 500 }
    );
  }
}
