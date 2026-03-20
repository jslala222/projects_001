# b-messenger (비즈니스 메신저 발송 시스템) - Claude 규칙

## 포트 규칙
- **이 프로젝트 (b-messenger)는 항상 6600 포트 사용** (`npm run dev` → `next dev -p 6600`)
- farm-manager: 5555, BMS: 3333 사용 중이므로 절대 사용 금지
- ⚠️ 6666 포트는 Next.js 예약 포트(ircu)로 사용 불가

## 개발 서버 시작
```bash
npm run dev  # 자동으로 6600 포트 사용
```

## Supabase 테이블 네이밍 규칙 ⭐
**모든 테이블 이름 앞에 `b-messenger_` 접두사를 붙인다.**
- 이유: 현재 Supabase DB에 다른 프로젝트 테이블이 함께 존재하여 구분이 필요함
- 예시:
  - `b-messenger_customers` (고객/연락처)
  - `b-messenger_send` (발송 기록)
  - `b-messenger_campaigns` (캠페인)
  - `b-messenger_templates` (메시지 템플릿)
  - `b-messenger_api_keys` (API 키 저장)
  - `b-messenger_users` (회원 정보)
  - `b-messenger_subscriptions` (요금제/구독)

## Supabase MCP 서버 연결
- Supabase MCP 서버가 설치되어 있으며, 아래 설정으로 연결됨
- **project_ref:** `lajjbrrysvkaxzrchanp`
- 테이블 생성/수정/조회 시 반드시 MCP 서버를 통해 연결 테스트 후 진행

## 발송 API 벤더 규칙 ⭐
**이 프로젝트는 솔라피(Solapi)를 발송 벤더로 사용한다.**
- ❌ 알리고(Aligo) 사용 안 함
- ❌ Twilio 사용 안 함
- ✅ **솔라피(Solapi)만 사용** — SMS, LMS, MMS, 카카오 알림톡, 카카오 친구톡 모두 솔라피 API로 처리
- 솔라피 API 문서: https://docs.solapi.com
- SaaS 회원이 솔라피에 직접 가입 → API 키 발급 → B-Messenger 설정 페이지에 입력하는 구조 (BYOK)
- 솔라피 관련 코드는 `lib/solapi.ts`에 모듈화하여 관리

## 작업 규칙
- 새 파일 생성 전 기존 파일 먼저 확인
- Supabase 환경변수는 `.env.local` 참조
- 컴포넌트는 `components/` 폴더에 정리

## 한국 시간대(KST) 규칙 ⭐
**모든 시간/날짜는 한국 시간(UTC+9)으로 처리**
- `next.config.ts`에 `process.env.TZ = "Asia/Seoul"` 설정됨
- 항상 `lib/utils.ts`의 한국 시간 함수 사용:
  - `getNowKST()` - 현재 한국 시간
  - `formatKSTDate()` - 포맷 형식 (기본값: 'YYYY-MM-DD HH:mm:ss')
  - `toKSTDateString()` - 날짜만 ('YYYY-MM-DD')
  - `formatKSTLocale()` - 한국식 포맷 ('2026. 3. 3. 오후 1:45:30')
  - `toKSTDate(date)` - Date 객체를 한국 시간으로 변환
- **절대금지**: `new Date().toUTCString()`, `new Date().toISOString()` (UTC 시간)

## 프로젝트 구분
- 🌾 **farm-manager** (포트: 5555) - 농장 관리 프로그램
- 📊 **BMS** (포트: 3333) - 건물/경영 관리 시스템
- 💬 **b-messenger** (포트: 6600) - 비즈니스 메신저 대량 발송 시스템
- 📨 **MSG System** (포트: 4444) - 고객 관리 메시지 발송 시스템
