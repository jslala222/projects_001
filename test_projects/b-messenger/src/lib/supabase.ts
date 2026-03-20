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
  TEMPLATES: "b-messenger_templates",
  CAMPAIGNS: "b-messenger_campaigns",
  SEND_LOGS: "b-messenger_send_logs",
  API_KEYS: "b-messenger_api_keys",
  SUBSCRIPTIONS: "b-messenger_subscriptions",
} as const;
