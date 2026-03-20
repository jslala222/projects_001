// ================================================================
// solapi.ts — 솔라피(Solapi) API 연동 모듈
// CLAUDE.md 규칙: 이 프로젝트는 솔라피만 사용
// 공식 문서: https://docs.solapi.com
// ================================================================

// ── 타입 정의 ──
export interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;    // 발신번호 (사전 등록 필수)
  kakaoChannelId?: string; // 카카오 채널 ID (알림톡/친구톡 사용 시)
}

export interface SendMessageRequest {
  to: string;           // 수신번호
  from: string;         // 발신번호
  text: string;         // 메시지 내용
  type?: "SMS" | "LMS" | "MMS" | "ATA" | "CTA"; // 메시지 타입
  imageId?: string;     // MMS 이미지 ID
  subject?: string;     // LMS/MMS 제목
  kakaoOptions?: {
    pfId: string;       // 카카오 채널 ID
    templateId?: string; // 알림톡 템플릿 ID
    buttons?: KakaoButton[];
  };
}

export interface KakaoButton {
  buttonType: "WL" | "AL" | "BK" | "MD" | "DS";
  buttonName: string;
  linkMobile?: string;
  linkPc?: string;
}

export interface SendResult {
  groupId: string;
  to: string;
  statusCode: string;
  statusMessage: string;
  messageId: string;
}

export interface SendResponse {
  groupId: string;
  messageId?: string;
  statusCode?: string;
  statusMessage?: string;
  accountId?: string;
}

// ── HMAC 서명 생성 (솔라피 인증 방식) ──
async function generateSignature(apiKey: string, apiSecret: string): Promise<{
  authorization: string;
}> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID();
  
  // HMAC-SHA256 서명 생성
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const data = encoder.encode(date + salt);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
  };
}

// ── 솔라피 API 클래스 ──
export class SolapiClient {
  private config: SolapiConfig;
  private baseUrl = "https://api.solapi.com";

  constructor(config: SolapiConfig) {
    this.config = config;
  }

  // 인증 헤더 생성
  private async getHeaders(): Promise<Record<string, string>> {
    const { authorization } = await generateSignature(
      this.config.apiKey,
      this.config.apiSecret
    );
    return {
      "Content-Type": "application/json",
      "Authorization": authorization,
    };
  }

  // ── 단건 SMS 발송 ──
  async sendSMS(to: string, text: string): Promise<SendResponse> {
    const headers = await this.getHeaders();
    const body = {
      message: {
        to,
        from: this.config.senderNumber,
        text,
        type: text.length > 90 ? "LMS" : "SMS", // 90바이트 초과 시 자동 LMS
      },
    };

    const res = await fetch(`${this.baseUrl}/messages/v4/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`솔라피 SMS 발송 실패: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    return res.json();
  }

  // ── 단건 MMS 발송 (이미지 포함) ──
  async sendMMS(to: string, text: string, imageId: string, subject?: string): Promise<SendResponse> {
    const headers = await this.getHeaders();
    const body = {
      message: {
        to,
        from: this.config.senderNumber,
        text,
        type: "MMS",
        imageId,
        subject: subject || "",
      },
    };

    const res = await fetch(`${this.baseUrl}/messages/v4/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`솔라피 MMS 발송 실패: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    return res.json();
  }

  // ── 카카오 알림톡 발송 ──
  async sendAlimTalk(
    to: string,
    templateId: string,
    variables: Record<string, string>,
    buttons?: KakaoButton[]
  ): Promise<SendResponse> {
    if (!this.config.kakaoChannelId) {
      throw new Error("카카오 채널 ID가 설정되지 않았습니다. 설정 페이지에서 입력해주세요.");
    }

    const headers = await this.getHeaders();
    const body = {
      message: {
        to,
        from: this.config.senderNumber,
        type: "ATA", // 알림톡
        kakaoOptions: {
          pfId: this.config.kakaoChannelId,
          templateId,
          variables,
          ...(buttons && { buttons }),
        },
      },
    };

    const res = await fetch(`${this.baseUrl}/messages/v4/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`솔라피 알림톡 발송 실패: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    return res.json();
  }

  // ── 카카오 친구톡 발송 ──
  async sendFriendTalk(
    to: string,
    text: string,
    imageId?: string,
    buttons?: KakaoButton[]
  ): Promise<SendResponse> {
    if (!this.config.kakaoChannelId) {
      throw new Error("카카오 채널 ID가 설정되지 않았습니다.");
    }

    const headers = await this.getHeaders();
    const body = {
      message: {
        to,
        from: this.config.senderNumber,
        text,
        type: "CTA", // 친구톡
        kakaoOptions: {
          pfId: this.config.kakaoChannelId,
          ...(imageId && { imageId }),
          ...(buttons && { buttons }),
        },
      },
    };

    const res = await fetch(`${this.baseUrl}/messages/v4/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`솔라피 친구톡 발송 실패: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    return res.json();
  }

  // ── 대량 발송 (여러 건 동시 발송) ──
  async sendMany(
    messages: SendMessageRequest[]
  ): Promise<SendResponse> {
    const headers = await this.getHeaders();
    const body = {
      messages: messages.map(msg => ({
        to: msg.to,
        from: msg.from || this.config.senderNumber,
        text: msg.text,
        type: msg.type || (msg.text.length > 90 ? "LMS" : "SMS"),
        ...(msg.kakaoOptions && { kakaoOptions: msg.kakaoOptions }),
        ...(msg.imageId && { imageId: msg.imageId }),
        ...(msg.subject && { subject: msg.subject }),
      })),
    };

    const res = await fetch(`${this.baseUrl}/messages/v4/send-many`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`솔라피 대량 발송 실패: ${res.status} - ${JSON.stringify(errorData)}`);
    }

    return res.json();
  }

  // ── 발송 결과 조회 ──
  async getMessageStatus(groupId: string): Promise<unknown> {
    const headers = await this.getHeaders();
    
    const res = await fetch(
      `${this.baseUrl}/messages/v4/list?groupId=${groupId}`,
      { headers }
    );

    if (!res.ok) {
      throw new Error(`발송 결과 조회 실패: ${res.status}`);
    }

    return res.json();
  }

  // ── 잔액 조회 ──
  async getBalance(): Promise<{ balance: number; point: number }> {
    const headers = await this.getHeaders();
    
    const res = await fetch(`${this.baseUrl}/cash/v1/balance`, { headers });

    if (!res.ok) {
      throw new Error(`잔액 조회 실패: ${res.status}`);
    }

    return res.json();
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

// ── 팩토리 함수: 설정으로 클라이언트 생성 ──
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
      if (!options?.imageId) {
        throw new Error("MMS에는 imageId가 필요합니다.");
      }
      return client.sendMMS(to, text, options.imageId, options?.subject);

    case "sms":
    default:
      return client.sendSMS(to, text);
  }
}
