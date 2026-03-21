-- 구독/결제 내역 관리 테이블 (장부) 생성
CREATE TABLE IF NOT EXISTS "b-messenger_payment_logs" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES "b-messenger_users"(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  depositor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

NOTIFY pgrst, 'reload schema';
