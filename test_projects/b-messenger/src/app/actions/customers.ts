// ================================================================
// app/actions/customers.ts — 고객(연락처) 관련 액션 함수
// GroupsClient.tsx 에서 import하여 사용
// ================================================================
import { supabase, TABLES } from "@/lib/supabase";
import type { Customer } from "@/types";

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── 고객(연락처) 목록 조회 ──
export async function getCustomers(options?: {
  pageSize?: number;
  search?: string;
  groupId?: string;
  tags?: string[];
  onlyCustomers?: boolean;
  addressBookId?: string | null;
}): Promise<{ data: Customer[] | null; total?: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, error: "로그인이 필요합니다" };

  const pageSize = options?.pageSize ?? 50;

  let q = supabase
    .from(TABLES.CONTACTS)
    .select("*", { count: "exact" })
    .eq("tenant_id", userId)
    .order("name", { ascending: true })
    .limit(pageSize);

  if (options?.onlyCustomers) {
    q = q.eq("is_customer", true);
  }
  if (options?.search?.trim()) {
    q = q.or(`name.ilike.%${options.search.trim()}%,phone.ilike.%${options.search.trim()}%`);
  }
  if (options?.groupId) {
    q = q.contains("group_ids", [options.groupId]);
  }
  if (options?.tags && options.tags.length > 0) {
    q = q.overlaps("interests", options.tags);
  }
  if (options?.addressBookId !== undefined && options.addressBookId !== null) {
    q = q.eq("address_book_id", options.addressBookId);
  }

  const { data, error, count } = await q;
  if (error) return { data: null, error: error.message };

  const customers: Customer[] = (data || []).map((c) => ({
    id: c.id,
    user_id: c.tenant_id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    birth_date: c.birthdate ?? null,
    investment_tendency: (c.gender as "male" | "female" | "business" | "other") ?? null,
    status: "active" as const,
    tags: (c.interests as string[]) ?? [],
    memo: c.memo ?? null,
    address: c.address ?? null,
    detail_address: null,
    postal_code: c.postal_code ?? null,
    created_at: c.created_at,
    updated_at: c.created_at,
    group_ids: (c.group_ids as string[]) ?? [],
    address_book_id: c.address_book_id ?? null,
  }));

  return { data: customers, total: count ?? 0 };
}
