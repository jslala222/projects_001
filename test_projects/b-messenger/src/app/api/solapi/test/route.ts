// ================================================================
// api/solapi/test/route.ts — 솔라피 API 연결 테스트
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createSolapiClient } from "@/lib/solapi";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, apiSecret } = await req.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json({
        success: true,
        message: "⚠️ Mock 모드 활성화 — API 키를 설정하면 실제 연동이 활성화됩니다.",
        mock: true,
      });
    }

    const client = createSolapiClient({
      apiKey,
      apiSecret,
      senderNumber: "",
    });

    // 실제 솔라피 잔액 조회 → 키 유효성 검증
    const result = await client.testConnection();

    if (result.success) {
      return NextResponse.json({
        success: true,
        mock: false,
        message: `연결이 성공하였습니다. 이제 저장 후 메시지를 보내보세요.`,
        balance: result.balance,
      });
    } else {
      return NextResponse.json({
        success: false,
        mock: false,
        message: `연결이 안되었습니다. API 키를 확인해 주세요. (${result.error})`,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      {
        success: false,
        mock: false,
        message: `연결이 안되었습니다. API 키를 확인해 주세요. (${message})`,
      },
      { status: 500 }
    );
  }
}
