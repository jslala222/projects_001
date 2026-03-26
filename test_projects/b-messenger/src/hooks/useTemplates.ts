// ================================================================
// hooks/useTemplates.ts — 저장된 메시지 템플릿 조회 공통 훅
// channelFilter: 현재 선택된 채널 (sms | lms | kakao_friend | kakao_alim)
//   → b-messenger_templates의 channel 값(sms | mms | kakao_friend | kakao_alim)과
//     lms ↔ sms / lms ↔ mms 매핑 처리
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { getTemplates, type MessageTemplate } from "@/app/actions/templates";

/** 채널 필터 정규화: 앱 채널 → DB 채널 */
function normalizeChannel(ch: string): string {
  // messages/page.tsx는 "lms"를 채널로 쓰지만
  // DB(b-messenger_templates)는 "sms"/"mms" 사용
  // → lms는 "sms" 계열로 처리
  if (ch === "lms") return "sms";
  return ch;
}

export function useTemplates(channelFilter?: string) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTemplates().then(({ data }) => {
      setLoading(false);
      if (!data) return;

      if (channelFilter) {
        const normalized = normalizeChannel(channelFilter);
        setTemplates(
          data.filter((t) => normalizeChannel(t.channel) === normalized)
        );
      } else {
        setTemplates(data);
      }
    });
  }, [channelFilter]);

  return { templates, loading };
}
