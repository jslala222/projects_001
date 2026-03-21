-- b-messenger_users 테이블에 구독 만료일 컬럼 추가
ALTER TABLE "b-messenger_users" 
ADD COLUMN IF NOT EXISTS "subscription_end_date" TIMESTAMP WITH TIME ZONE;
