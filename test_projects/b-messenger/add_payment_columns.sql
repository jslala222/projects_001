-- b-messenger_users 테이블에 무통장 입금 및 구독 승인을 위한 컬럼 추가
ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS "plan_request" TEXT;
ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS "depositor_name" TEXT;
ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS "payment_status" TEXT;

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
