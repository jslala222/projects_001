-- ================================================================
-- 마이그레이션: 그룹 멤버 조인 테이블 + 발송 파이프라인 설계
-- 날짜: 2026-03-22
-- 목적:
--   1. contacts.group_ids TEXT[] 배열 방식 → 전용 조인 테이블로 전환
--   2. 재귀 멤버 카운트 뷰 생성 (상위 그룹 = 하위 합산)
--   3. 발송 타겟 / 캠페인 필터 테이블 추가
-- ⚠️ 데이터 무결성 최우선: 기존 group_ids 데이터를 모두 마이그레이션 후 유지
-- ================================================================

-- ── 1. 그룹 멤버 조인 테이블 생성 ────────────────────────────────
CREATE TABLE IF NOT EXISTS "b-messenger_group_members" (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID        NOT NULL,
  group_id    UUID        NOT NULL,
  contact_id  UUID        NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 참조 무결성: 그룹/연락처 삭제 시 자동 정리 (CASCADE)
  CONSTRAINT fk_gm_group   FOREIGN KEY (group_id)
    REFERENCES "b-messenger_groups"(id)   ON DELETE CASCADE,
  CONSTRAINT fk_gm_contact FOREIGN KEY (contact_id)
    REFERENCES "b-messenger_contacts"(id) ON DELETE CASCADE,

  -- 중복 방지
  CONSTRAINT uq_gm_group_contact UNIQUE (group_id, contact_id)
);

-- 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_gm_group_id   ON "b-messenger_group_members" (group_id);
CREATE INDEX IF NOT EXISTS idx_gm_contact_id ON "b-messenger_group_members" (contact_id);
CREATE INDEX IF NOT EXISTS idx_gm_tenant_id  ON "b-messenger_group_members" (tenant_id);


-- ── 2. 기존 contacts.group_ids 데이터 마이그레이션 ────────────────
-- ⚠️ 핵심: 배열에 있는 그룹 ID가 실제 groups 테이블에 존재하는 것만 이전
--          orphan 참조는 자동 제외 (데이터 정합성 보장)
INSERT INTO "b-messenger_group_members" (tenant_id, group_id, contact_id)
SELECT DISTINCT
  c.tenant_id,
  gid::uuid  AS group_id,
  c.id       AS contact_id
FROM "b-messenger_contacts" c
CROSS JOIN LATERAL unnest(c.group_ids) AS gid
JOIN "b-messenger_groups" g
  ON g.id = gid::uuid
WHERE
  c.group_ids IS NOT NULL
  AND array_length(c.group_ids, 1) > 0
ON CONFLICT (group_id, contact_id) DO NOTHING;

-- 마이그레이션 결과 검증 (실행 후 숫자 확인용)
DO $$
DECLARE
  v_old_count BIGINT;
  v_new_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_old_count
  FROM (
    SELECT DISTINCT c.id, gid::uuid AS gid
    FROM "b-messenger_contacts" c
    CROSS JOIN LATERAL unnest(c.group_ids) AS gid
    JOIN "b-messenger_groups" g ON g.id = gid::uuid
    WHERE c.group_ids IS NOT NULL AND array_length(c.group_ids, 1) > 0
  ) sub;

  SELECT COUNT(*) INTO v_new_count FROM "b-messenger_group_members";

  IF v_old_count = v_new_count THEN
    RAISE NOTICE '✅ 마이그레이션 성공: % 건 이전 완료', v_new_count;
  ELSE
    RAISE WARNING '⚠️ 마이그레이션 불일치: old=%, new=%', v_old_count, v_new_count;
  END IF;
END $$;


-- ── 3. 재귀 멤버 카운트 뷰 ────────────────────────────────────────
-- 각 그룹의 직접 멤버 수 + 모든 하위 그룹 멤버 합산
-- 예: 최상위(ABL생명) → 대(월납300만원) → 중(정액3명, 추납7명)
--   → 最上位 total = 10, 大 total = 10, 중1 = 3, 중2 = 7
DROP VIEW IF EXISTS "b-messenger_group_member_counts";
CREATE VIEW "b-messenger_group_member_counts" AS
WITH RECURSIVE group_descendants AS (
  -- Base: 자기 자신
  SELECT
    id  AS root_id,
    id  AS node_id,
    0   AS rel_depth
  FROM "b-messenger_groups"

  UNION ALL

  -- Recursive: 자식 그룹 탐색
  SELECT
    gd.root_id,
    g.id  AS node_id,
    gd.rel_depth + 1
  FROM group_descendants gd
  JOIN "b-messenger_groups" g ON g.parent_id = gd.node_id
)
SELECT
  gd.root_id                                          AS group_id,
  COUNT(DISTINCT gm.contact_id)                       AS total_member_count,
  COUNT(DISTINCT CASE
    WHEN gm.group_id = gd.root_id THEN gm.contact_id
  END)                                                AS direct_member_count
FROM group_descendants gd
LEFT JOIN "b-messenger_group_members" gm
  ON gm.group_id = gd.node_id
GROUP BY gd.root_id;


-- ── 4. 발송 타겟 테이블 ────────────────────────────────────────────
-- 캠페인의 발송 대상을 그룹/개인연락처/필터 세 가지 방식으로 지정
CREATE TABLE IF NOT EXISTS "b-messenger_send_targets" (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID        NOT NULL,
  campaign_id   UUID        NOT NULL,
  target_type   TEXT        NOT NULL CHECK (target_type IN ('group', 'contact', 'filter')),

  -- target_type = 'group'   인 경우
  group_id      UUID        REFERENCES "b-messenger_groups"(id)   ON DELETE SET NULL,
  -- target_type = 'contact' 인 경우
  contact_id    UUID        REFERENCES "b-messenger_contacts"(id) ON DELETE SET NULL,
  -- target_type = 'filter'  인 경우
  filter_json   JSONB,

  -- 집계 캐시 (발송 전 미리 계산)
  estimated_count INT       DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_st_campaign FOREIGN KEY (campaign_id)
    REFERENCES "b-messenger_campaigns"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_st_campaign_id ON "b-messenger_send_targets" (campaign_id);
CREATE INDEX IF NOT EXISTS idx_st_tenant_id   ON "b-messenger_send_targets" (tenant_id);


-- ── 5. 캠페인 필터 저장 테이블 ───────────────────────────────────
-- 자주 쓰는 필터 조합을 저장해 재사용
-- filter_json 예시:
--   { "groups": ["id1","id2"], "tags": ["VIP"], "gender": "female",
--     "address_book_id": "abid", "min_amount": 3000000 }
CREATE TABLE IF NOT EXISTS "b-messenger_campaign_filters" (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID        NOT NULL,
  name        TEXT        NOT NULL,
  filter_json JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cf_tenant_id ON "b-messenger_campaign_filters" (tenant_id);


-- ── 6. RLS (Row Level Security) 정책 ─────────────────────────────
-- b-messenger_group_members
ALTER TABLE "b-messenger_group_members" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gm_tenant_select" ON "b-messenger_group_members";
CREATE POLICY "gm_tenant_select" ON "b-messenger_group_members"
  FOR SELECT USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "gm_tenant_insert" ON "b-messenger_group_members";
CREATE POLICY "gm_tenant_insert" ON "b-messenger_group_members"
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "gm_tenant_delete" ON "b-messenger_group_members";
CREATE POLICY "gm_tenant_delete" ON "b-messenger_group_members"
  FOR DELETE USING (tenant_id = auth.uid());

-- b-messenger_send_targets
ALTER TABLE "b-messenger_send_targets" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "st_tenant_all" ON "b-messenger_send_targets";
CREATE POLICY "st_tenant_all" ON "b-messenger_send_targets"
  FOR ALL USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

-- b-messenger_campaign_filters
ALTER TABLE "b-messenger_campaign_filters" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cf_tenant_all" ON "b-messenger_campaign_filters";
CREATE POLICY "cf_tenant_all" ON "b-messenger_campaign_filters"
  FOR ALL USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());


-- ── 7. contacts.group_ids 레거시 보존 안내 ───────────────────────
-- ⚠️ contacts.group_ids 컬럼은 즉시 삭제하지 않습니다.
--    신규 코드는 b-messenger_group_members 를 사용하고,
--    group_ids 컬럼은 롤백 보험 및 하위호환을 위해 유지합니다.
--    충분한 검증 후 별도 마이그레이션으로 제거하세요:
--
--    ALTER TABLE "b-messenger_contacts" DROP COLUMN group_ids;
--
-- ================================================================
