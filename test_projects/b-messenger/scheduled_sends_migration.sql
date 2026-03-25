-- ================================================================
-- b-messenger 예약 발송 테이블 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- project_ref: lajjbrrysvkaxzrchanp
-- ================================================================

-- 예약 발송 테이블
CREATE TABLE IF NOT EXISTS "b-messenger_scheduled_sends" (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  title         TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  channel       TEXT        NOT NULL DEFAULT 'sms'
                            CHECK (channel IN ('sms','lms','mms','kakao_alim','kakao_friend')),
  recipients    JSONB       NOT NULL DEFAULT '[]',  -- [{name, phone}]
  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','sent','cancelled','failed')),
  sent_at       TIMESTAMPTZ,
  success_count INTEGER     NOT NULL DEFAULT 0,
  fail_count    INTEGER     NOT NULL DEFAULT 0,
  result        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스: 처리 대상 조회 최적화 (cron이 사용)
CREATE INDEX IF NOT EXISTS idx_scheduled_sends_pending
  ON "b-messenger_scheduled_sends" (status, scheduled_at)
  WHERE status = 'pending';

-- RLS 활성화
ALTER TABLE "b-messenger_scheduled_sends" ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 자신의 예약만 접근 가능
DROP POLICY IF EXISTS "users_own_scheduled_sends" ON "b-messenger_scheduled_sends";
CREATE POLICY "users_own_scheduled_sends"
  ON "b-messenger_scheduled_sends"
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- (선택) Supabase pg_cron 자동 처리 설정
-- Supabase 대시보드 > Database > Extensions 에서
-- pg_cron 과 pg_net 을 활성화한 후 아래 실행
-- ================================================================
-- SELECT cron.schedule(
--   'b-messenger-process-scheduled',
--   '* * * * *',   -- 1분마다
--   $$
--     SELECT net.http_post(
--       url := 'https://<YOUR_VERCEL_DOMAIN>/api/scheduled/process',
--       headers := '{"Content-Type":"application/json","x-cron-secret":"<YOUR_SECRET>"}',
--       body := '{}'
--     );
--   $$
-- );
