// ================================================================
// setup_tables.mjs — Supabase Management API로 테이블 생성
// Supabase의 /pg/query 엔드포인트를 사용하여 DDL 실행
// 실행: node setup_tables.mjs
// ================================================================

const SUPABASE_URL = 'https://lajjbrrysvkaxzrchanp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhampicnJ5c3ZrYXh6cmNoYW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA4NTA4NiwiZXhwIjoyMDg1NjYxMDg2fQ.BWzwGYk_Gv8sYNIPIJBu95_hzYGXdZNra4F1tnF04N0';
const DB_PASSWORD = '@@0401dsuc@@';

const ALL_SQL = `
-- 1. 회원 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_users" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 그룹 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_groups" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#667eea',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 연락처 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_contacts" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  memo TEXT DEFAULT '',
  group_ids TEXT[] DEFAULT '{}',
  is_kakao_friend BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 템플릿 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_templates" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('kakao_alim', 'kakao_friend', 'sms', 'mms')),
  content TEXT NOT NULL,
  image_url TEXT,
  buttons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 캠페인 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_campaigns" (
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
);

-- 6. 발송 로그
CREATE TABLE IF NOT EXISTS "b-messenger_send_logs" (
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
);

-- 7. API 키
CREATE TABLE IF NOT EXISTS "b-messenger_api_keys" (
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
);

-- 8. 구독
CREATE TABLE IF NOT EXISTS "b-messenger_subscriptions" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  expires_at TIMESTAMPTZ,
  payment_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bm_contacts_tenant ON "b-messenger_contacts"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bm_contacts_phone ON "b-messenger_contacts"(phone);
CREATE INDEX IF NOT EXISTS idx_bm_campaigns_tenant ON "b-messenger_campaigns"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bm_campaigns_status ON "b-messenger_campaigns"(status);
CREATE INDEX IF NOT EXISTS idx_bm_send_logs_campaign ON "b-messenger_send_logs"(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bm_templates_tenant ON "b-messenger_templates"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bm_groups_tenant ON "b-messenger_groups"(tenant_id);

-- 테스트 사용자
INSERT INTO "b-messenger_users" (email, name, plan) 
VALUES ('admin@b-messenger.com', '관리자', 'enterprise')
ON CONFLICT (email) DO NOTHING;
`;

async function runSQL() {
  console.log('🚀 B-Messenger Supabase 테이블 생성 시작...\n');

  // 방법 1: Supabase pg/query 엔드포인트 (새 프로젝트에서 지원)
  try {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ query: ALL_SQL }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('✅ 방법1 (pg/query) 성공!');
      console.log(JSON.stringify(data, null, 2));
      await verifyTables();
      return;
    }
    console.log(`⚠️ 방법1 실패 (${res.status}): ${await res.text()}`);
  } catch (err) {
    console.log(`⚠️ 방법1 오류: ${err.message}`);
  }

  // 방법 2: SQL 문을 하나씩 분리하여 실행
  const statements = ALL_SQL.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    
    try {
      const res = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ query: trimmed }),
      });

      if (res.ok) {
        const tableName = trimmed.match(/\"(b-messenger_\w+)\"/)?.[1] || trimmed.substring(0, 50);
        console.log(`✅ ${tableName}`);
      } else {
        console.log(`❌ 실패: ${await res.text()}`);
      }
    } catch (err) {
      console.log(`❌ 오류: ${err.message}`);
    }
  }

  await verifyTables();
}

async function verifyTables() {
  // 테이블 확인: REST API로 각 테이블에 SELECT 시도
  console.log('\n📋 테이블 존재 확인:');
  const tables = [
    'b-messenger_users', 'b-messenger_groups', 'b-messenger_contacts',
    'b-messenger_templates', 'b-messenger_campaigns', 'b-messenger_send_logs',
    'b-messenger_api_keys', 'b-messenger_subscriptions'
  ];

  for (const table of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
      if (res.ok) {
        console.log(`   ✅ ${table} — 존재함`);
      } else {
        console.log(`   ❌ ${table} — ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.log(`   ❌ ${table} — 오류: ${err.message}`);
    }
  }

  console.log('\n🎉 완료!');
}

runSQL();
