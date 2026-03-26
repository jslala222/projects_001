// ================================================================
// app/actions/templates.ts — 템플릿 관련 액션 함수
// ================================================================
import { supabase, TABLES } from "@/lib/supabase";

export interface MessageTemplate {
  id: string;
  name: string;
  /** b-messenger_templates.channel: "kakao_alim" | "kakao_friend" | "sms" | "mms" */
  channel: string;
  content: string;
  createdAt: string;
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getTemplates(): Promise<{
  data: MessageTemplate[] | null;
  error?: string;
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from(TABLES.TEMPLATES)
    .select("id, name, channel, content, created_at")
    .eq("tenant_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };

  const templates: MessageTemplate[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as string,
    content: row.content as string,
    createdAt: row.created_at as string,
  }));

  return { data: templates };
}
