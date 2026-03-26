-- ================================================================
-- fix_api_keys_table.sql
-- b-messenger_api_keys 테이블 FK 문제 수정
-- 실행 방법: Supabase 대시보드 → SQL Editor 에 붙여넣고 실행
-- ================================================================

-- 1. 기존 테이블 FK 제약 제거 후 재생성 (auth.users 직접 참조)
DROP TABLE IF EXISTS "b-messenger_api_keys";

CREATE TABLE IF NOT EXISTS "b-messenger_api_keys" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,   -- auth.users 직접 참조 (FK 없음)
  vendor TEXT NOT NULL DEFAULT 'solapi',
  api_key TEXT DEFAULT '',
  api_secret TEXT DEFAULT '',
  sender_number TEXT DEFAULT '',
  kakao_channel_id TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS 활성화
ALTER TABLE "b-messenger_api_keys" ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책: 본인 데이터만 접근
DROP POLICY IF EXISTS "users_own_api_keys" ON "b-messenger_api_keys";
CREATE POLICY "users_own_api_keys"
  ON "b-messenger_api_keys"
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
