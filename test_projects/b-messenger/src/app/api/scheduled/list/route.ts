// ================================================================
// api/scheduled/list/route.ts — 예약 발송 목록 조회
// GET ?status=pending|sent|cancelled|failed|all
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseServer
      .from(TABLES.SCHEDULED_SENDS)
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: true });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { success: false, message: `조회 실패: ${msg}` },
      { status: 500 }
    );
  }
}
