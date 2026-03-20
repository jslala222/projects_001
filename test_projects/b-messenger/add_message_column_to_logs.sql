-- b-messenger_send_logs 테이블에 개별 치환된 메시지를 저장할 컬럼 추가
ALTER TABLE "b-messenger_send_logs" ADD COLUMN "message" TEXT;

-- (선택 사항) 기존 로그에 대해 기본값 등으로 채우고 싶을 경우
COMMENT ON COLUMN "b-messenger_send_logs"."message" IS '수신자별로 치환이 완료된 최종 발송 메시지 내용';
