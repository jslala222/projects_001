-- ================================================================
-- B-Messenger SaaS (aos_erp1 프로젝트용 통합 SQL)
-- 테이블 전체 생성 + 휴대폰/역할/상태 컬럼 포함
-- ================================================================

-- 1. 회원 테이블 (SaaS 사용자)
CREATE TABLE IF NOT EXISTS "b-messenger_users" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'pending',
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
  template_id UUID REFERENCES "b-messenger_templates"(id) ON DELETE SET NULL,
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

-- 6. 발송 로그 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_send_logs" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES "b-messenger_campaigns"(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES "b-messenger_contacts"(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'fallback')),
  channel_used TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. API 키 테이블 (암호화 저장)
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

-- 8. 구독/요금제 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_subscriptions" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  expires_at TIMESTAMPTZ,
  payment_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON "b-messenger_contacts"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON "b-messenger_contacts"(phone);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON "b-messenger_campaigns"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON "b-messenger_campaigns"(status);
CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON "b-messenger_send_logs"(campaign_id);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON "b-messenger_templates"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_groups_tenant ON "b-messenger_groups"(tenant_id);
