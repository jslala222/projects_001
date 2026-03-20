-- ================================================================
-- b-messenger_users 테이블에 phone, role, status 컬럼 추가
-- Supabase SQL Editor에서 실행해주세요!
-- ================================================================

-- 1) 휴대폰 번호 컬럼
ALTER TABLE "b-messenger_users"
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- 2) 역할 컬럼 (admin = 관리자, user = 일반 사용자)
ALTER TABLE "b-messenger_users"
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 3) 승인 상태 컬럼 (pending = 대기, approved = 승인, rejected = 거부)
ALTER TABLE "b-messenger_users"
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
