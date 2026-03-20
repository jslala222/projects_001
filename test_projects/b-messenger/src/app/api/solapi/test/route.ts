// ================================================================
// api/solapi/test/route.ts — 솔라피 API 연결 테스트
// 비유: "전화선이 연결되었는지" 확인하는 버튼
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createSolapiClient } from "@/lib/solapi";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, apiSecret } = await req.json();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, message: "API 키와 시크릿을 입력해주세요." },
        { status: 400 }
      );
    }

    // 솔라피 클라이언트 생성 후 잔액 조회로 연결 테스트
    const client = createSolapiClient({
      apiKey,
      apiSecret,
      senderNumber: "", // 연결 테스트에는 불필요
    });
    const balance = await client.getBalance();

    return NextResponse.json({
      success: true,
      message: `✅ 연결 성공! 잔액: ${balance.balance?.toLocaleString() ?? 0}원`,
      balance: balance.balance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { success: false, message: `❌ 연결 실패: ${message}` },
      { status: 500 }
    );
  }
}
