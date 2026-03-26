// ================================================================
// app/actions/groups.ts — 그룹 관련 액션 함수
// ☑ b-messenger_group_members 조인 테이블 기반 (group_ids 배열 탈피)
// ☑ b-messenger_group_member_counts 뷰로 재귀 합산 카운트
// ☑ dual-write: group_members + contacts.group_ids 동시 유지
//   → contacts.group_ids 는 롤백 보험용으로 보존
// ================================================================
import { supabase, TABLES } from "@/lib/supabase";
import type { Group } from "@/types";

// 현재 로그인 사용자 ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── 그룹 목록 조회 (재귀 카운트 뷰 활용) ──────────────────────────
export async function getGroups(): Promise<{ data: Group[] | null; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  // 그룹 목록 (path 정렬 → 트리 순서 보장)
  const { data, error } = await supabase
    .from(TABLES.GROUPS)
    .select("*")
    .eq("tenant_id", userId)
    .order("path", { ascending: true, nullsFirst: false });

  if (error) return { data: null, error: error.message };
  if (!data || data.length === 0) return { data: [] };

  const groupIds = data.map((g) => g.id);

  // 재귀 카운트 뷰: 자신 + 모든 하위 그룹 멤버 합산
  // 뷰가 없으면 group_members 직접 카운트로 fallback
  let countMap: Record<string, number> = {};

  const { data: counts, error: countErr } = await supabase
    .from(TABLES.GROUP_MEMBER_COUNTS)
    .select("group_id, total_member_count")
    .in("group_id", groupIds);

  if (!countErr && counts) {
    countMap = Object.fromEntries(
      counts.map((c) => [c.group_id as string, c.total_member_count as number])
    );
  } else {
    // fallback: group_members 직접 집계 (뷰 미생성 환경 대비)
    const { data: members } = await supabase
      .from(TABLES.GROUP_MEMBERS)
      .select("group_id")
      .in("group_id", groupIds);

    (members ?? []).forEach((m) => {
      countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1;
    });
  }

  const groups: Group[] = data.map((g) => ({
    id: g.id,
    user_id: g.tenant_id,
    name: g.name,
    description: g.description ?? "",
    color: g.color,
    created_at: g.created_at,
    updated_at: g.updated_at ?? g.created_at,
    member_count: countMap[g.id] ?? 0,
    parent_id: g.parent_id ?? null,
    depth: g.depth ?? 0,
    path: g.path ?? g.id,
  }));

  return { data: groups };
}

// ── 그룹 생성 ──
export async function createGroup(
  name: string,
  description: string,
  color: string,
  parentId?: string | null
): Promise<{ data: Group | null; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  // 부모 그룹 정보 조회 → depth/path 계산
  let depth = 0;
  let parentPath: string | null = null;

  if (parentId) {
    const { data: parent } = await supabase
      .from(TABLES.GROUPS)
      .select("depth, path")
      .eq("id", parentId)
      .single();
    if (!parent) return { data: null, error: "부모 그룹을 찾을 수 없습니다" };
    if ((parent.depth ?? 0) >= 3) return { data: null, error: "최대 4단계까지만 생성 가능합니다" };
    depth = (parent.depth ?? 0) + 1;
    parentPath = parent.path ?? parentId; // path가 null이면 id를 fallback으로 사용
  }

  // id를 미리 생성해서 path를 INSERT 시점에 함께 설정
  const newId = crypto.randomUUID();
  const path = parentPath ? `${parentPath}.${newId}` : newId;

  const { data, error } = await supabase
    .from(TABLES.GROUPS)
    .insert({
      id: newId,
      tenant_id: userId,
      name,
      description,
      color,
      parent_id: parentId ?? null,
      depth,
      path,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  const group: Group = {
    id: data.id,
    user_id: data.tenant_id,
    name: data.name,
    description: data.description ?? "",
    color: data.color,
    created_at: data.created_at,
    updated_at: data.updated_at ?? data.created_at,
    member_count: 0,
    parent_id: parentId ?? null,
    depth,
    path,
  };

  return { data: group };
}

// ── 그룹 수정 ──
export async function updateGroup(
  id: string,
  name: string,
  description: string,
  color: string
): Promise<{ data: Group | null; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from(TABLES.GROUPS)
    .update({ name, description, color })
    .eq("id", id)
    .eq("tenant_id", userId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  const group: Group = {
    id: data.id,
    user_id: data.tenant_id,
    name: data.name,
    description: data.description ?? "",
    color: data.color,
    created_at: data.created_at,
    updated_at: data.updated_at ?? data.created_at,
    parent_id: data.parent_id ?? null,
    depth: data.depth ?? 0,
    path: data.path ?? data.id,
  };

  return { data: group };
}

// ── 그룹 삭제 (하위 그룹 포함) ──
// ✅ CASCADE: group_members FK가 ON DELETE CASCADE 이므로 자동 멤버 정리
// ✅ 레거시: contacts.group_ids 배열에서도 해당 ID 제거 (dual-write 보수)
export async function deleteGroup(id: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  const { data: targetGroup } = await supabase
    .from(TABLES.GROUPS)
    .select("path")
    .eq("id", id)
    .single();

  const pathPrefix = targetGroup?.path ?? id;

  // 삭제 대상 ID 목록
  const { data: allTargets } = await supabase
    .from(TABLES.GROUPS)
    .select("id")
    .eq("tenant_id", userId)
    .or(`id.eq.${id},path.like.${pathPrefix}.%`);

  const targetIds = (allTargets ?? []).map((g) => g.id);

  // 레거시 dual-write: contacts.group_ids 배열에서도 제거
  for (const gid of targetIds) {
    const { data: legacyContacts } = await supabase
      .from(TABLES.CONTACTS)
      .select("id, group_ids")
      .contains("group_ids", [gid]);

    if (legacyContacts && legacyContacts.length > 0) {
      for (const c of legacyContacts) {
        const cleaned = ((c.group_ids as string[]) ?? []).filter((x) => x !== gid);
        await supabase
          .from(TABLES.CONTACTS)
          .update({ group_ids: cleaned })
          .eq("id", c.id);
      }
    }
  }

  // 하위 그룹부터 역순 삭제 (CASCADE가 group_members 자동 정리)
  const { data: toDelete } = await supabase
    .from(TABLES.GROUPS)
    .select("id")
    .eq("tenant_id", userId)
    .or(`id.eq.${id},path.like.${pathPrefix}.%`)
    .order("path", { ascending: false });

  for (const g of toDelete ?? []) {
    await supabase.from(TABLES.GROUPS).delete().eq("id", g.id);
  }

  return {};
}

// ── 그룹 멤버 조회 ──
// ✅ group_members 조인 테이블 기반 (신규)
// 폴백: group_members 가 비어있으면 레거시 group_ids로 확인
export async function getGroupMembers(
  groupId: string
): Promise<{ data: import("@/types").Customer[] | null; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  // 1차: group_members 조인 테이블
  const { data: memberRows, error: memberErr } = await supabase
    .from(TABLES.GROUP_MEMBERS)
    .select("contact_id")
    .eq("group_id", groupId);

  let contactIds: string[] = [];

  if (!memberErr && memberRows && memberRows.length > 0) {
    contactIds = memberRows.map((r) => r.contact_id as string);
  } else {
    // fallback: 레거시 group_ids 배열
    const { data: legacyContacts } = await supabase
      .from(TABLES.CONTACTS)
      .select("id")
      .contains("group_ids", [groupId]);
    contactIds = (legacyContacts ?? []).map((c) => c.id as string);
  }

  if (contactIds.length === 0) return { data: [] };

  const { data, error } = await supabase
    .from(TABLES.CONTACTS)
    .select("*")
    .in("id", contactIds)
    .order("name", { ascending: true });

  if (error) return { data: null, error: error.message };

  const customers = (data || []).map((c) => ({
    id: c.id,
    user_id: c.tenant_id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    birth_date: c.birthdate ?? null,
    investment_tendency: (c.gender as import("@/types").Customer["investment_tendency"]) ?? null,
    status: "active" as const,
    tags: (c.interests as string[]) ?? [],
    memo: c.memo ?? null,
    address: c.address ?? null,
    detail_address: null,
    postal_code: c.postal_code ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at ?? c.created_at,
    group_ids: (c.group_ids as string[]) ?? [],
    address_book_id: c.address_book_id ?? null,
  }));

  return { data: customers };
}

// ── 연락처를 그룹에 추가 ──
// ✅ dual-write: group_members 테이블 + contacts.group_ids 레거시 배열 동시 유지
export async function addCustomersToGroup(
  groupId: string,
  customerIds: string[]
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  // pre-filter: 이미 이 그룹 멤버인 고객 제외 (DB UNIQUE 제약 이중 방어)
  const { data: existing } = await supabase
    .from(TABLES.GROUP_MEMBERS)
    .select("contact_id")
    .eq("group_id", groupId)
    .in("contact_id", customerIds);

  const existingIds = new Set((existing ?? []).map((r) => r.contact_id as string));
  const newIds = customerIds.filter((id) => !existingIds.has(id));
  if (newIds.length === 0) return {};

  // 1차: group_members 조인 테이블에 신규 고객만 bulk insert
  const rows = newIds.map((cid) => ({
    tenant_id: userId,
    group_id: groupId,
    contact_id: cid,
  }));

  const { error: insertErr } = await supabase
    .from(TABLES.GROUP_MEMBERS)
    .upsert(rows, { onConflict: "group_id,contact_id", ignoreDuplicates: true });

  if (insertErr) return { error: insertErr.message };

  // 2차: 레거시 dual-write — contacts.group_ids 배열도 유지
  const { data: contacts } = await supabase
    .from(TABLES.CONTACTS)
    .select("id, group_ids")
    .in("id", newIds);

  if (contacts) {
    for (const c of contacts) {
      const current = (c.group_ids as string[]) ?? [];
      if (!current.includes(groupId)) {
        await supabase
          .from(TABLES.CONTACTS)
          .update({ group_ids: [...current, groupId] })
          .eq("id", c.id);
      }
    }
  }

  return {};
}

// ── 연락처를 그룹에서 제거 ──
// ✅ dual-write: group_members + contacts.group_ids 동시 삭제
export async function removeCustomerFromGroup(
  groupId: string,
  customerId: string
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  // 1차: group_members 테이블에서 제거
  const { error: delErr } = await supabase
    .from(TABLES.GROUP_MEMBERS)
    .delete()
    .eq("group_id", groupId)
    .eq("contact_id", customerId);

  if (delErr) return { error: delErr.message };

  // 2차: 레거시 dual-write — contacts.group_ids 배열에서도 제거
  const { data: contact } = await supabase
    .from(TABLES.CONTACTS)
    .select("id, group_ids")
    .eq("id", customerId)
    .single();

  if (contact) {
    const updated = ((contact.group_ids as string[]) ?? []).filter(
      (gid: string) => gid !== groupId
    );
    await supabase
      .from(TABLES.CONTACTS)
      .update({ group_ids: updated })
      .eq("id", customerId);
  }

  return {};
}

// ── 그룹 + 모든 하위 그룹 ID 목록 조회 ──────────────────────────
// path prefix 방식으로 클라이언트에서 빠르게 처리
export async function getGroupDescendantIds(
  groupId: string
): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [groupId];

  // 대상 그룹의 path 조회
  const { data: root } = await supabase
    .from(TABLES.GROUPS)
    .select("id, path")
    .eq("id", groupId)
    .single();

  if (!root) return [groupId];

  const pathPrefix = root.path ?? groupId;

  // 자신 + 하위 그룹 전체 조회
  const { data: allGroups } = await supabase
    .from(TABLES.GROUPS)
    .select("id")
    .eq("tenant_id", userId)
    .or(`id.eq.${groupId},path.like.${pathPrefix}.%`);

  return (allGroups ?? []).map((g) => g.id as string);
}

// ── 그룹(+ 하위 포함) 전체 연락처 조회 — 발송용 ─────────────────
// ⚠️ 발송 전 대상 확인에 사용. 중복 제거 보장
export async function getGroupMembersForSend(
  groupId: string
): Promise<{
  data: import("@/types").Customer[] | null;
  totalCount: number;
  groupIds: string[];
  error?: string;
}> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, totalCount: 0, groupIds: [], error: "로그인이 필요합니다" };

  // 1. 하위 그룹 포함 전체 group ID 목록
  const groupIds = await getGroupDescendantIds(groupId);

  // 2. group_members 테이블에서 contact_id 수집 (DISTINCT)
  const { data: memberRows, error: memberErr } = await supabase
    .from(TABLES.GROUP_MEMBERS)
    .select("contact_id")
    .in("group_id", groupIds);

  let contactIds: string[] = [];

  if (!memberErr && memberRows && memberRows.length > 0) {
    // 중복 제거 (동일 연락처가 여러 하위 그룹에 있을 수 있음)
    contactIds = [...new Set(memberRows.map((r) => r.contact_id as string))];
  } else {
    // fallback: 레거시 group_ids 배열
    const { data: legacyContacts } = await supabase
      .from(TABLES.CONTACTS)
      .select("id")
      .overlaps("group_ids", groupIds);
    contactIds = [...new Set((legacyContacts ?? []).map((c) => c.id as string))];
  }

  if (contactIds.length === 0) {
    return { data: [], totalCount: 0, groupIds };
  }

  // 3. 연락처 상세 조회
  const { data, error } = await supabase
    .from(TABLES.CONTACTS)
    .select("id, name, phone, email, gender, interests, address_book_id, tenant_id, created_at")
    .in("id", contactIds)
    .order("name", { ascending: true });

  if (error) return { data: null, totalCount: 0, groupIds, error: error.message };

  const customers = (data || []).map((c) => ({
    id: c.id as string,
    user_id: c.tenant_id as string,
    name: c.name as string,
    phone: c.phone as string,
    email: (c.email as string) ?? null,
    birth_date: null,
    investment_tendency: (c.gender as import("@/types").Customer["investment_tendency"]) ?? null,
    status: "active" as const,
    tags: (c.interests as string[]) ?? [],
    memo: null,
    address: null,
    detail_address: null,
    postal_code: null,
    created_at: c.created_at as string,
    updated_at: c.created_at as string,
    group_ids: [],
    address_book_id: (c.address_book_id as string) ?? null,
  }));

  return { data: customers, totalCount: customers.length, groupIds };
}
