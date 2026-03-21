// ================================================================
// app/actions/groups.ts — 그룹 관련 액션 함수
// GroupsClient.tsx 에서 import하여 사용
// ================================================================
import { supabase, TABLES } from "@/lib/supabase";
import type { Group } from "@/types";

// 현재 로그인 사용자 ID 조회
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── 그룹 목록 조회 (path 기준 정렬 → 트리 순서) ──
export async function getGroups(): Promise<{ data: Group[] | null; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from(TABLES.GROUPS)
    .select("*")
    .eq("tenant_id", userId)
    .order("path", { ascending: true });

  if (error) return { data: null, error: error.message };

  // member_count 계산
  const { data: contacts } = await supabase
    .from(TABLES.CONTACTS)
    .select("id, group_ids")
    .eq("tenant_id", userId);

  const groups: Group[] = (data || []).map((g) => ({
    id: g.id,
    user_id: g.tenant_id,
    name: g.name,
    description: g.description ?? "",
    color: g.color,
    created_at: g.created_at,
    updated_at: g.updated_at ?? g.created_at,
    member_count: (contacts || []).filter(
      (c) => Array.isArray(c.group_ids) && c.group_ids.includes(g.id)
    ).length,
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
    parentPath = parent.path;
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
export async function deleteGroup(id: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  // 삭제 대상: 자신 + path로 시작하는 하위 그룹 전체
  const { data: targetGroup } = await supabase
    .from(TABLES.GROUPS)
    .select("path")
    .eq("id", id)
    .single();

  const pathPrefix = targetGroup?.path ?? id;

  // 하위 그룹 ID 목록
  const { data: allTargets } = await supabase
    .from(TABLES.GROUPS)
    .select("id")
    .eq("tenant_id", userId)
    .or(`id.eq.${id},path.like.${pathPrefix}.%`);

  const targetIds = (allTargets ?? []).map((g) => g.id);

  // 연락처의 group_ids에서 해당 그룹 ID들 제거
  for (const gid of targetIds) {
    const { data: contacts } = await supabase
      .from(TABLES.CONTACTS)
      .select("id, group_ids")
      .eq("tenant_id", userId)
      .contains("group_ids", [gid]);

    if (contacts && contacts.length > 0) {
      for (const c of contacts) {
        await supabase
          .from(TABLES.CONTACTS)
          .update({ group_ids: (c.group_ids as string[]).filter((x: string) => x !== gid) })
          .eq("id", c.id);
      }
    }
  }

  // 하위 그룹부터 역순 삭제 (path 내림차순 = 깊은 것부터)
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
export async function getGroupMembers(
  groupId: string
): Promise<{ data: import("@/types").Customer[] | null; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  const { data, error } = await supabase
    .from(TABLES.CONTACTS)
    .select("*")
    .eq("tenant_id", userId)
    .contains("group_ids", [groupId])
    .order("name", { ascending: true });

  if (error) return { data: null, error: error.message };

  const customers = (data || []).map((c) => ({
    id: c.id,
    user_id: c.tenant_id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    birth_date: c.birthdate ?? null,
    investment_tendency: null,
    status: "active" as const,
    tags: (c.interests as string[]) ?? [],
    memo: c.memo ?? null,
    address: c.address ?? null,
    detail_address: null,
    postal_code: c.postal_code ?? null,
    created_at: c.created_at,
    updated_at: c.created_at,
  }));

  return { data: customers };
}

// ── 연락처를 그룹에 추가 ──
export async function addCustomersToGroup(
  groupId: string,
  customerIds: string[]
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  // 각 연락처의 group_ids 배열에 groupId 추가
  const { data: contacts } = await supabase
    .from(TABLES.CONTACTS)
    .select("id, group_ids")
    .eq("tenant_id", userId)
    .in("id", customerIds);

  if (!contacts) return { error: "연락처 조회 실패" };

  for (const c of contacts) {
    const current = (c.group_ids as string[]) ?? [];
    if (!current.includes(groupId)) {
      await supabase
        .from(TABLES.CONTACTS)
        .update({ group_ids: [...current, groupId] })
        .eq("id", c.id);
    }
  }

  return {};
}

// ── 연락처를 그룹에서 제거 ──
export async function removeCustomerFromGroup(
  customerId: string,
  groupId: string
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  const { data: contact } = await supabase
    .from(TABLES.CONTACTS)
    .select("id, group_ids")
    .eq("id", customerId)
    .eq("tenant_id", userId)
    .single();

  if (!contact) return { error: "연락처를 찾을 수 없습니다" };

  const updated = ((contact.group_ids as string[]) ?? []).filter((id: string) => id !== groupId);

  const { error } = await supabase
    .from(TABLES.CONTACTS)
    .update({ group_ids: updated })
    .eq("id", customerId);

  if (error) return { error: error.message };
  return {};
}
