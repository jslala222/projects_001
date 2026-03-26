// ================================================================
// solapi.ts — 솔라피(Solapi) API 연동 모듈 (공식 Node.js SDK 사용)
// CLAUDE.md 규칙: 이 프로젝트는 솔라피만 사용
// 공식 문서: https://docs.solapi.com
// npm: solapi v5
// ================================================================

import { SolapiMessageService } from "solapi";

// ── 타입 정의 ──
export interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
  kakaoChannelId?: string;
}

export interface SendMessageRequest {
  to: string;
  from?: string;
  text: string;
  type?: "SMS" | "LMS" | "MMS" | "ATA" | "CTA";
  imageId?: string;
  subject?: string;
  kakaoOptions?: {
    pfId: string;
    templateId?: string;
    buttons?: KakaoButton[];
  };
}

export interface KakaoButton {
  buttonType: "WL" | "AL" | "BK" | "MD" | "DS";
  buttonName: string;
  linkMobile?: string;
  linkPc?: string;
}

export interface SendResponse {
  groupId?: string;
  messageId?: string;
  statusCode?: string;
  statusMessage?: string;
  [key: string]: unknown;
}

// ── Mock 응답 생성 ──
function mockSendResponse(to: string): SendResponse {
  return {
    groupId: `MOCK-GROUP-${Date.now()}`,
    messageId: `MOCK-MSG-${Date.now()}`,
    statusCode: "2000",
    statusMessage: `OK (Mock Mode) → ${to}`,
  };
}

// ── 솔라피 클라이언트 래퍼 ──
export class SolapiClient {
  private config: SolapiConfig;
  private sdk: SolapiMessageService;

  constructor(config: SolapiConfig) {
    this.config = config;
    this.sdk = new SolapiMessageService(config.apiKey, config.apiSecret);
  }

  private get isMock(): boolean {
    return process.env.SOLAPI_MOCK === "true" || !this.config.apiKey || !this.config.apiSecret;
  }

  // ── 단건 SMS 발송 ──
  async sendSMS(to: string, text: string): Promise<SendResponse> {
    if (this.isMock) return mockSendResponse(to);
    const result = await this.sdk.sendOne({
      to,
      from: this.config.senderNumber,
      text,
      type: text.length > 90 ? "LMS" : "SMS",
    });
    const r = result as SendResponse & { statusCode?: string; statusMessage?: string };
    if (r.statusCode && r.statusCode !== "2000") {
      throw new Error(`발송 실패 [${r.statusCode}]: ${r.statusMessage || "알 수 없는 오류"}`);
    }
    return r;
  }

  // ── 단건 LMS 발송 ──
  async sendLMS(to: string, text: string, subject?: string): Promise<SendResponse> {
    if (this.isMock) return mockSendResponse(to);
    const result = await this.sdk.sendOne({
      to,
      from: this.config.senderNumber,
      text,
      type: "LMS",
      ...(subject && { subject }),
    });
    const r = result as SendResponse & { statusCode?: string; statusMessage?: string };
    if (r.statusCode && r.statusCode !== "2000") {
      throw new Error(`발송 실패 [${r.statusCode}]: ${r.statusMessage || "알 수 없는 오류"}`);
    }
    return r;
  }

  // ── 단건 MMS 발송 (이미지 포함) ──
  async sendMMS(to: string, text: string, imageId: string, subject?: string): Promise<SendResponse> {
    if (this.isMock) return mockSendResponse(to);
    const result = await this.sdk.sendOne({
      to,
      from: this.config.senderNumber,
      text,
      type: "MMS",
      imageId,
      ...(subject && { subject }),
    });
    const mmsR = result as SendResponse & { statusCode?: string; statusMessage?: string };
    if (mmsR.statusCode && mmsR.statusCode !== "2000") {
      throw new Error(`MMS 발송 실패 [${mmsR.statusCode}]: ${mmsR.statusMessage || "알 수 없는 오류"}`);
    }
    return mmsR;
  }

  // ── 카카오 알림톡 발송 ──
  async sendAlimTalk(
    to: string,
    templateId: string,
    variables: Record<string, string>,
    buttons?: KakaoButton[]
  ): Promise<SendResponse> {
    if (this.isMock) return mockSendResponse(to);
    if (!this.config.kakaoChannelId) {
      throw new Error("카카오 채널 ID가 설정되지 않았습니다. 설정 페이지에서 입력해주세요.");
    }
    const result = await this.sdk.sendOne({
      to,
      from: this.config.senderNumber,
      kakaoOptions: {
        pfId: this.config.kakaoChannelId,
        templateId,
        variables,
        ...(buttons && { buttons }),
      },
    } as Parameters<SolapiMessageService["sendOne"]>[0]);
    const alimR = result as SendResponse & { statusCode?: string; statusMessage?: string };
    if (alimR.statusCode && alimR.statusCode !== "2000") {
      throw new Error(`알림톡 발송 실패 [${alimR.statusCode}]: ${alimR.statusMessage || "알 수 없는 오류"}`);
    }
    return alimR;
  }

  // ── 카카오 친구톡 발송 ──
  async sendFriendTalk(
    to: string,
    text: string,
    imageId?: string,
    buttons?: KakaoButton[]
  ): Promise<SendResponse> {
    if (this.isMock) return mockSendResponse(to);
    if (!this.config.kakaoChannelId) {
      throw new Error("카카오 채널 ID가 설정되지 않았습니다.");
    }
    const result = await this.sdk.sendOne({
      to,
      from: this.config.senderNumber,
      text,
      kakaoOptions: {
        pfId: this.config.kakaoChannelId,
        ...(imageId && { imageId }),
        ...(buttons && { buttons }),
      },
    } as Parameters<SolapiMessageService["sendOne"]>[0]);
    const friendR = result as SendResponse & { statusCode?: string; statusMessage?: string };
    if (friendR.statusCode && friendR.statusCode !== "2000") {
      throw new Error(`친구톡 발송 실패 [${friendR.statusCode}]: ${friendR.statusMessage || "알 수 없는 오류"}`);
    }
    return friendR;
  }

  // ── 대량 발송 ──
  async sendMany(messages: SendMessageRequest[]): Promise<SendResponse> {
    if (this.isMock) return mockSendResponse(messages[0]?.to ?? "");
    const result = await this.sdk.send(
      messages.map(msg => ({
        to: msg.to,
        from: msg.from || this.config.senderNumber,
        text: msg.text,
        type: msg.type || (msg.text.length > 90 ? "LMS" : "SMS"),
        ...(msg.imageId && { imageId: msg.imageId }),
        ...(msg.subject && { subject: msg.subject }),
        ...(msg.kakaoOptions && { kakaoOptions: msg.kakaoOptions }),
      })) as Parameters<SolapiMessageService["send"]>[0]
    );
    return result as SendResponse;
  }

  // ── 잔액 조회 ──
  async getBalance(): Promise<{ balance: number; point: number }> {
    if (this.isMock) return { balance: 0, point: 0 };
    const result = await this.sdk.getBalance();
    return {
      balance: (result as { balance?: number }).balance ?? 0,
      point: (result as { point?: number }).point ?? 0,
    };
  }

  // ── 연결 테스트 (API 키 유효성 검증) ──
  async testConnection(): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
      const result = await this.getBalance();
      return { success: true, balance: result.balance };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "연결 테스트 실패",
      };
    }
  }
}

// ── 팩토리 함수 ──
export function createSolapiClient(config: SolapiConfig): SolapiClient {
  return new SolapiClient(config);
}

// ── 채널별 발송 함수 (범용) ──
export async function sendByChannel(
  client: SolapiClient,
  channel: string,
  to: string,
  text: string,
  options?: {
    templateId?: string;
    variables?: Record<string, string>;
    imageId?: string;
    buttons?: KakaoButton[];
    subject?: string;
  }
): Promise<SendResponse> {
  switch (channel) {
    case "kakao_alim":
      if (!options?.templateId || !options?.variables) {
        throw new Error("알림톡에는 templateId와 variables가 필요합니다.");
      }
      return client.sendAlimTalk(to, options.templateId, options.variables, options.buttons);

    case "kakao_friend":
      return client.sendFriendTalk(to, text, options?.imageId, options?.buttons);

    case "mms":
      if (!options?.imageId) throw new Error("MMS에는 imageId가 필요합니다.");
      return client.sendMMS(to, text, options.imageId, options.subject);

    case "lms":
      return client.sendLMS(to, text, options?.subject);

    case "sms":
    default:
      return client.sendSMS(to, text);
  }
}
