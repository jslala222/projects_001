# B-Messenger 플랜 설계 문서
> 작성일: 2026-03-22 | 최종 확정안

---

## 핵심 원칙

1. **데이터는 `b-messenger_contacts` 하나만** (절대 복사 없음)
   - `/contacts` (주소록)와 `/customers` (고객관리)는 **동일 테이블을 다른 UI로** 보는 것
2. **발송 건수 제한 없음** — 솔라피 BYOK (본인 API 키 등록) 구조이므로
3. **팀 멤버 기능 없음** — 1계정 = 1사람 구조 유지 (추후 별도 기획)

---

## 플랜별 기능 제한 확정표

| 기능 |                      FREE |  PRO   | ENTERPRISE |
|------|:----:|:---:|:----------:|
| **주소록 인원**           | 100명 | 5,000명 | 무제한 |
| **주소록 탭 수**          | 1개 | 2개 | 5개 |
| **CSV 업로드**            | ❌ | ✅ | ✅ |
| **수작업 연락처 추가**    | ✅ (100명 한도) | ✅ | ✅ |
| **고객관리 (/customers)** | ❌ 잠금 | ✅ | ✅ |
| **그룹관리 (/groups)**    | ❌ 잠금 | ✅ | ✅ |
| **그룹 생성 수**          | ❌ | 5개 | 무제한 |
| **그룹 depth**            | ❌ | 3단계 (대/중/소) | 4단계 (최상위/대/중/소) |
| **템플릿관리**            | ❌ 잠금 | ✅ 20개 | ✅ 무제한 |
| **발송 방식 (FREE)**      | 검색→체크→1건씩 | — | — |
| **발송 방식 (PRO+)**      | —   | 그룹 대량 발송 | 그룹 대량 발송 |
| **발송 채널 SMS/LMS**     | ✅ | ✅ | ✅ |
| **발송 채널 카카오**      | ❌ | ✅ | ✅ |
| **발송 건수 제한**        | 없음 | 없음 | 없음 |
| **솔라피 API 등록**       | ✅ BYOK | ✅ BYOK | ✅ BYOK |
| **발송 이력 조회**        | ❌ | ✅ 30일 | ✅ 무제한 |
| **커스텀 필드**           | ❌ | ✅ 5개 | ✅ 무제한 |

     ## 추후구현  팀 멤버	1명 	3명 	무제한 

---

## 페이지별 역할 분리

### `/contacts` — 주소록 (FREE 포함 전체 접근)
- 주소록 탭 관리 (FREE: 1개, PRO: 2개, ENT: 5개)
- 연락처 목록 + 검색
- 수작업 연락처 추가/삭제 (FREE: 100명 한도)
- CSV 업로드 → **PRO+ 잠금**
- 개별 체크박스 선택 후 SMS 발송 (FREE 허용)

### `/customers` — 고객관리 (PRO+ 잠금 🔒)
- 그룹 필터 태그 (주소록에서 이동)
- 상세 CRM (메모, 커스텀 필드, 계약 정보)
- 발송 이력 조회
- 고급 필터링 (태그 조합, 날짜 범위 등)

### `/groups` — 그룹관리 (PRO+ 잠금 🔒)
- 계층 그룹 트리 (PRO: depth 3, ENT: depth 4)
- 그룹 생성 (PRO: 5개 제한, ENT: 무제한)
- 그룹 멤버 관리
- 그룹 대량 발송

### `/templates` — 템플릿관리 (PRO+ 잠금 🔒)
- 메시지 템플릿 저장/재사용
- 변수 치환 지원 (`#{이름}`, `#{전화번호}`, `#{메모}`)
- PRO: 20개, ENT: 무제한

---

## FREE 플랜 사용 흐름 (맛보기)

```
1. 회원가입 → 솔라피 API 키 등록 (설정 페이지)
2. /contacts 에서 수작업으로 연락처 추가 (최대 100명)
3. 연락처 검색 → 체크박스 선택
4. SMS 발송 (솔라피 계정으로 전송)
5. 고객관리/그룹관리/템플릿 → 잠금 배너 + 업그레이드 유도
```

---

## 구현 방식

### `usePlan()` 훅 (중앙 관리)
```ts
// 사용 예시
const { plan, limits, can } = usePlan();

can("csv_upload")        // false (FREE)
can("group_management")  // false (FREE)
limits.maxContacts       // 100 (FREE)
limits.maxGroups         // 0 (FREE)
```

### `<PlanGate>` 컴포넌트
```tsx
// PRO+ 전용 기능 감싸기
<PlanGate require="pro" feature="고객관리">
  <CustomerManagement />
</PlanGate>
// → FREE: 잠금 배너 + "PRO로 업그레이드" 버튼 표시
// → PRO+: children 정상 렌더
```

### 서버 액션 제한 체크
```ts
// contacts INSERT 시 100명 제한 (FREE)
const count = await getContactCount(userId);
const limit = getPlanLimit(plan, "maxContacts");
if (count >= limit) throw new Error("FREE 플랜 한도 초과 (100명)");
```

---

## DB 플랜 확인 구조

```sql
-- b-messenger_subscriptions 테이블
id, user_id, plan ('free'|'pro'|'enterprise'), 
status ('active'|'expired'), expires_at

-- 플랜 확인 쿼리
SELECT plan FROM b-messenger_subscriptions
WHERE user_id = auth.uid() AND status = 'active'
ORDER BY created_at DESC LIMIT 1;
-- 없으면 → 'free' 처리
```

---

## 구현 우선순위

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | `b-messenger_customers` 테이블 존재 여부 확인 | 있으면 contacts로 통합 |
| 2 | `usePlan()` 훅 생성 | subscriptions 테이블 조회 |
| 3 | `<PlanGate>` 컴포넌트 생성 | 잠금 배너 UI 포함 |
| 4 | `/customers`, `/groups`, `/templates` 페이지에 PlanGate 적용 | |
| 5 | CSV 업로드 버튼 PRO+ 잠금 | |
| 6 | contacts INSERT 100명 제한 서버 액션 | |
| 7 | 주소록 탭 수 플랜별 제한 | |
| 8 | 그룹 생성 5개 제한 (PRO) | |

---

*이 문서는 구현 기준 문서입니다. 변경 시 이 파일도 함께 업데이트하세요.*
