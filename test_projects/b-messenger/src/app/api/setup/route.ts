// ================================================================
// /api/setup/route.ts — Supabase 테이블 초기 설정 API
// 브라우저에서 http://localhost:6600/api/setup 호출 시 테이블 생성
// ================================================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// service_role 키로 관리자 권한 클라이언트 생성
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 테이블 생성 SQL 목록
const createTableSQLs = [
  {
    name: "b-messenger_users",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_users" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_groups",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_groups" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#667eea',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_contacts",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_contacts" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      memo TEXT DEFAULT '',
      group_ids TEXT[] DEFAULT '{}',
      is_kakao_friend BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_templates",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_templates" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('kakao_alim', 'kakao_friend', 'sms', 'mms')),
      content TEXT NOT NULL,
      image_url TEXT,
      buttons JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_campaigns",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_campaigns" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      template_id UUID,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'paused')),
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      send_rate INTEGER DEFAULT 300,
      fallback_enabled BOOLEAN DEFAULT TRUE,
      scheduled_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_send_logs",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_send_logs" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      campaign_id UUID,
      contact_id UUID,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'fallback')),
      channel_used TEXT NOT NULL,
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_api_keys",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_api_keys" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID UNIQUE REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
      vendor TEXT NOT NULL DEFAULT 'solapi' CHECK (vendor IN ('solapi', 'aligo', 'twilio')),
      api_key TEXT DEFAULT '',
      api_secret TEXT DEFAULT '',
      sender_number TEXT DEFAULT '',
      kakao_channel_id TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
  {
    name: "b-messenger_subscriptions",
    sql: `CREATE TABLE IF NOT EXISTS "b-messenger_subscriptions" (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID UNIQUE REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'free',
      expires_at TIMESTAMPTZ,
      payment_key TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  },
];

export async function GET() {
  const results: { name: string; status: string; error?: string }[] = [];

  for (const item of createTableSQLs) {
    try {
      const { error } = await supabaseAdmin.rpc("exec_sql", {
        query: item.sql,
      });

      if (error) {
        // rpc가 안 되면 REST API 직접 호출
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
          {
            method: "POST",
            headers: {
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ query: item.sql }),
          }
        );

        if (!res.ok) {
          results.push({ name: item.name, status: "❌ 실패", error: error.message });
        } else {
          results.push({ name: item.name, status: "✅ 성공" });
        }
      } else {
        results.push({ name: item.name, status: "✅ 성공" });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ name: item.name, status: "❌ 실패", error: errorMsg });
    }
  }

  // 테스트 사용자 삽입
  try {
    const { error } = await supabaseAdmin
      .from("b-messenger_users")
      .upsert(
        { email: "admin@b-messenger.com", name: "관리자", plan: "enterprise" },
        { onConflict: "email" }
      );
    results.push({
      name: "테스트 사용자(admin)",
      status: error ? "❌ 실패" : "✅ 성공",
      error: error?.message,
    });
  } catch {
    results.push({ name: "테스트 사용자", status: "⏭️ 스킵 (테이블 미생성)" });
  }

  const successCount = results.filter((r) => r.status.includes("성공")).length;

  return NextResponse.json({
    message: `🎉 ${successCount}/${results.length} 항목 처리 완료`,
    results,
  });
}
