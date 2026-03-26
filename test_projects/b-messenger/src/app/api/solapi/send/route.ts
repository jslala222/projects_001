// ================================================================
// api/solapi/send/route.ts — 솔라피 실제 메시지 발송
// 비유: "문자를 실제로 보내는" 전송 버튼
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { createSolapiClient, sendByChannel } from "@/lib/solapi";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, apiSecret, senderNumber, kakaoChannelId, recipientNumber, message, channel } = await req.json();

    if (!apiKey || !apiSecret) {
      // Mock 모드: 실제 발송 없이 성공 시뮬레이션
      return NextResponse.json({
        success: true,
        message: `⚠️ Mock 발송 완료 (${recipientNumber || "?"}) — 실제 발송 아님`,
        mock: true,
      });
    }

    if (!senderNumber || !recipientNumber) {
      return NextResponse.json(
        { success: false, message: "발신번호와 수신번호를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    // 솔라피 클라이언트 생성
    const client = createSolapiClient({
      apiKey,
      apiSecret,
      senderNumber,
      ...(kakaoChannelId && { kakaoChannelId }),
    });

    // 채널별 발송
    const result = await sendByChannel(
      client,
      channel || "sms",
      recipientNumber,
      message || "B-Messenger 테스트 발송입니다.",
    );

    return NextResponse.json({
      success: true,
      message: `발송 요청 성공! (${recipientNumber}) — 솔라피 콘솔에서 수신 확인하세요.`,
      statusCode: (result as { statusCode?: string }).statusCode,
      result,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json(
      { success: false, message: `❌ 발송 실패: ${errMessage}` },
      { status: 500 }
    );
  }
}
