// ================================================================
// supabase.ts — Supabase 클라이언트 설정
// CLAUDE.md 규칙: 테이블명 앞에 'b-messenger_' 접두사 필수
// ================================================================
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 프론트엔드용 클라이언트 (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 테이블 이름 상수 (b-messenger_ 접두사 적용)
export const TABLES = {
  USERS: "b-messenger_users",
  CONTACTS: "b-messenger_contacts",
  GROUPS: "b-messenger_groups",
  // 그룹 멤버 조인 테이블 (contacts.group_ids 배열 대체)
  GROUP_MEMBERS: "b-messenger_group_members",
  // 재귀 멤버 카운트 뷰 (상위→하위 합산)
  GROUP_MEMBER_COUNTS: "b-messenger_group_member_counts",
  TEMPLATES: "b-messenger_templates",
  CAMPAIGNS: "b-messenger_campaigns",
  SEND_LOGS: "b-messenger_send_logs",
  // 발송 타겟 (그룹/개인/필터 3종)
  SEND_TARGETS: "b-messenger_send_targets",
  // 저장된 필터 조합
  CAMPAIGN_FILTERS: "b-messenger_campaign_filters",
  API_KEYS: "b-messenger_api_keys",
  SUBSCRIPTIONS: "b-messenger_subscriptions",
  ADDRESS_BOOKS: "b-messenger_address_books",
  SCHEDULED_SENDS: "b-messenger_scheduled_sends",
} as const;
