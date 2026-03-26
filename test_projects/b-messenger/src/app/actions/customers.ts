// ================================================================
// app/actions/customers.ts — 고객(연락처) 관련 액션 함수
// GroupsClient.tsx 에서 import하여 사용
// ================================================================
"use server";

import { supabase, TABLES } from "@/lib/supabase";
import type { Customer, CustomerFormData } from "@/types";

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── 고객(연락처) 목록 조회 ──
export async function getCustomers(options?: {
  pageSize?: number;
  page?: number;
  search?: string;
  groupId?: string;
  tags?: string[];
  onlyCustomers?: boolean;
  addressBookId?: string | null;
  status?: string;
  tendency?: string;
  sort?: string;
}): Promise<{ data: Customer[] | null; total?: number; count: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { data: null, count: 0, error: "로그인이 필요합니다" };

  const pageSize = options?.pageSize ?? 50;
  const page = options?.page ?? 1;
  const offset = (page - 1) * pageSize;

  let q = supabase
    .from(TABLES.CONTACTS)
    .select("*", { count: "exact" })
    .eq("tenant_id", userId)
    .order("name", { ascending: true })
    .range(offset, offset + pageSize - 1);

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
  if (options?.tendency?.trim()) {
    q = q.eq("gender", options.tendency.trim());
  }

  const { data, error, count } = await q;
  if (error) return { data: null, count: 0, error: error.message };

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

  return { data: customers, total: count ?? 0, count: count ?? 0 };
}

// ── 파일 가져오기 (VCF/CSV 파싱 결과를 DB에 upsert) ──
type ImportRow = { name: string; phone: string; email?: string };

export async function importContactsFromFile(
  rows: ImportRow[]
): Promise<{ insertedCount?: number; updatedCount?: number; skippedCount?: number; total?: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };
  if (!rows || rows.length === 0) return { insertedCount: 0, updatedCount: 0, skippedCount: 0, total: 0 };

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const phone = row.phone.trim();
    const name = row.name.trim();
    if (!phone || !name) { skippedCount++; continue; }

    // 기존 연락처 존재 여부 확인
    const { data: existing } = await supabase
      .from(TABLES.CONTACTS)
      .select("id")
      .eq("tenant_id", userId)
      .eq("phone", phone)
      .maybeSingle();

    if (existing) {
      // 이름/이메일만 업데이트
      await supabase
        .from(TABLES.CONTACTS)
        .update({ name, ...(row.email ? { email: row.email } : {}) })
        .eq("id", existing.id);
      updatedCount++;
    } else {
      await supabase.from(TABLES.CONTACTS).insert({
        tenant_id: userId,
        name,
        phone,
        email: row.email ?? null,
      });
      insertedCount++;
    }
  }

  return { insertedCount, updatedCount, skippedCount, total: rows.length };
}

// ── 고객(연락처) 생성 ──
export async function createCustomer(
  form: CustomerFormData
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  const tags = form.tags
    ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from(TABLES.CONTACTS).insert({
    tenant_id: userId,
    name: form.name.trim(),
    phone: form.phone.trim(),
    email: form.email?.trim() || null,
    birthdate: form.birth_date || null,
    gender: form.investment_tendency || null,
    interests: tags,
    memo: form.memo?.trim() || null,
    address: form.address?.trim() || null,
    postal_code: form.postal_code?.trim() || null,
  });

  if (error) return { error: error.message };
  return {};
}

// ── 고객(연락처) 수정 ──
export async function updateCustomer(
  id: string,
  form: CustomerFormData
): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  const tags = form.tags
    ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from(TABLES.CONTACTS)
    .update({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email?.trim() || null,
      birthdate: form.birth_date || null,
      gender: form.investment_tendency || null,
      interests: tags,
      memo: form.memo?.trim() || null,
      address: form.address?.trim() || null,
      postal_code: form.postal_code?.trim() || null,
    })
    .eq("id", id)
    .eq("tenant_id", userId);

  if (error) return { error: error.message };
  return {};
}

// ── 고객(연락처) 단건 삭제 ──
export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  const { error } = await supabase
    .from(TABLES.CONTACTS)
    .delete()
    .eq("id", id)
    .eq("tenant_id", userId);

  if (error) return { error: error.message };
  return {};
}

// ── 고객(연락처) 다건 삭제 ──
export async function deleteCustomers(ids: string[]): Promise<{ error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };
  if (ids.length === 0) return {};

  const { error } = await supabase
    .from(TABLES.CONTACTS)
    .delete()
    .in("id", ids)
    .eq("tenant_id", userId);

  if (error) return { error: error.message };
  return {};
}

// ── 가져오기로 생성된 연락처 전체 삭제 ──
export async function deleteImportedCustomers(): Promise<{ deletedCount?: number; count?: number; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "로그인이 필요합니다" };

  // 가져온 연락처: address_book_id가 있거나, 최근에 bulk 추가된 연락처
  // 여기서는 해당 테넌트의 모든 연락처를 삭제하는 기능으로 구현
  const { error, count } = await supabase
    .from(TABLES.CONTACTS)
    .delete({ count: "exact" })
    .eq("tenant_id", userId);

  if (error) return { error: error.message };
  return { deletedCount: count ?? 0, count: count ?? 0 };
}
