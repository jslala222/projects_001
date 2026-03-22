// ================================================================
// store.ts — Supabase 데이터 저장소 (DB 연동 버전)
// 비유: 앱의 "두뇌" 역할. 이제 클라우드 DB에서 데이터를 관리합니다.
// CLAUDE.md: 테이블명 앞에 'b-messenger_' 접두사 필수
// ================================================================
import { supabase, TABLES } from "./supabase";
import { createSolapiClient, sendByChannel, type SolapiConfig } from "./solapi";

// ── 타입 정의 ──
export interface Contact {
  id: string;
  name: string;
  phone: string;
  memo: string;
  groupIds: string[];
  isKakaoFriend: boolean;
  isCustomer: boolean;
  createdAt: string;
  // 확장 필드
  addressBookId?: string | null;
  email?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  job?: string | null;
  interests?: string[] | null;
  address?: string | null;
  postalCode?: string | null;
  marketingAgree?: boolean;
  joinDate?: string | null;
  // 입력 방식: 'csv' = CSV업로드(수정 전), 'manual' = 직접입력 or 수정된 CSV
  source?: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  contactCount: number;
}

export interface Template {
  id: string;
  name: string;
  channel: "kakao_alim" | "kakao_friend" | "sms" | "mms";
  content: string;
  imageUrl?: string;
  buttons?: { label: string; url: string }[];
  createdAt: string;
}

export interface CampaignRecipient {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  status: "pending" | "sent" | "failed" | "fallback";
  channelUsed: string;
  errorMessage?: string;
  sentAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  templateId?: string;
  message: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "paused";
  totalCount: number;
  successCount: number;
  failCount: number;
  sendRate: number;
  fallbackEnabled: boolean;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  recipients: CampaignRecipient[];
  createdAt: string;
}

export interface ApiSetting {
  provider: "solapi";
  apiKey: string;
  apiSecret: string;
  senderNumber?: string;
  kakaoChannelId?: string;
  isActive: boolean;
}

export interface AddressBook {
  id: string;
  name: string;
  slot: number;
  contactCount: number;
  createdAt: string;
}

// ── 테넌트 ID (Supabase Auth 기반) ──
// 전역 캐시 제거: 다중 계정 환경에서 이전 계정 ID가 캐시될 수 있어 항상 auth에서 조회
async function getTenantId(): Promise<string> {
  // Supabase Auth에서 현재 로그인한 사용자 가져오기
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return user.id;
  }

  // 로그인하지 않은 경우 (개발/테스트용 폴백)
  const { data: existing } = await supabase
    .from(TABLES.USERS)
    .select("id")
    .eq("email", "admin@b-messenger.com")
    .single();

  if (existing) {
    return existing.id as string;
  }

  // 테스트 사용자 생성
  const { data: created, error } = await supabase
    .from(TABLES.USERS)
    .insert({ email: "admin@b-messenger.com", name: "관리자", plan: "free" })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error("테넌트 사용자 생성 실패: " + error?.message);
  }

  return created.id as string;
}

// ── DB 데이터 → 프론트 타입 변환 헬퍼 ──
function dbToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    memo: (row.memo as string) || "",
    groupIds: (row.group_ids as string[]) || [],
    isKakaoFriend: (row.is_kakao_friend as boolean) || false,
    isCustomer: (row.is_customer as boolean) || false,
    createdAt: row.created_at as string,
    addressBookId: (row.address_book_id as string) ?? null,
    email: (row.email as string) ?? null,
    gender: (row.gender as string) ?? null,
    birthdate: (row.birthdate as string) ?? null,
    job: (row.job as string) ?? null,
    interests: (row.interests as string[]) ?? null,
    address: (row.address as string) ?? null,
    postalCode: (row.postal_code as string) ?? null,
    marketingAgree: (row.marketing_agree as boolean) ?? true,
    joinDate: (row.join_date as string) ?? null,
    source: (row.source as string) || 'manual',
  };
}

function dbToGroup(row: Record<string, unknown>, contactCount: number = 0): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    contactCount,
  };
}

function dbToTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as Template["channel"],
    content: row.content as string,
    imageUrl: row.image_url as string | undefined,
    buttons: row.buttons as { label: string; url: string }[] | undefined,
    createdAt: row.created_at as string,
  };
}

function dbToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    name: row.name as string,
    channel: row.channel as string,
    templateId: row.template_id as string | undefined,
    message: row.message as string,
    status: row.status as Campaign["status"],
    totalCount: (row.total_count as number) || 0,
    successCount: (row.success_count as number) || 0,
    failCount: (row.fail_count as number) || 0,
    sendRate: (row.send_rate as number) || 300,
    fallbackEnabled: (row.fallback_enabled as boolean) ?? true,
    scheduledAt: row.scheduled_at as string | undefined,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
    recipients: [],
    createdAt: row.created_at as string,
  };
}

// ── Supabase 데이터 스토어 ──
class DataStore {
  // ── 연락처 ──
  async getContacts(onlyCustomers: boolean = false, addressBookId?: string | null): Promise<Contact[]> {
    const tenantId = await getTenantId();
    const CHUNK = 1000;
    const allRows: Record<string, unknown>[] = [];
    let from = 0;

    // Supabase PostgREST max_rows=1000 제한 우회: 1000건씩 반복 요청
    while (true) {
      let q = supabase
        .from(TABLES.CONTACTS)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(from, from + CHUNK - 1);

      if (onlyCustomers) q = q.eq("is_customer", true);
      if (addressBookId !== undefined && addressBookId !== null) {
        q = q.eq("address_book_id", addressBookId);
      }

      const { data, error } = await q;
      if (error) { console.error("연락처 조회 오류:", error); break; }
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < CHUNK) break;
      from += CHUNK;
    }

    return allRows.map(dbToContact);
  }

  // 서버사이드 페이지네이션 + 검색 + 정렬
  async getContactsPaged(
    page: number,
    pageSize: number,
    onlyCustomers = false,
    addressBookId?: string | null,
    search?: string,
    sortBy: "name" | "created_at" | "join_date" | "gender" | "marketing_agree" = "name",
    sortDir: "asc" | "desc" = "asc",
    filterGroupId?: string | null,
    filterTags?: string[]
  ): Promise<{ contacts: Contact[]; total: number }> {
    const tenantId = await getTenantId();
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let q = supabase
      .from(TABLES.CONTACTS)
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId);

    if (onlyCustomers) q = q.eq("is_customer", true);
    if (addressBookId !== undefined && addressBookId !== null) {
      q = q.eq("address_book_id", addressBookId);
    }
    if (search && search.trim()) {
      q = q.or(`name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
    }
    if (filterGroupId) {
      q = q.contains("group_ids", [filterGroupId]);
    }
    if (filterTags && filterTags.length > 0) {
      q = q.overlaps("interests", filterTags);
    }

    const { data, error, count } = await q
      .order(sortBy, { ascending: sortDir === "asc", nullsFirst: false })
      .range(from, to);

    if (error) { console.error("연락처 페이지 조회 오류:", error); return { contacts: [], total: 0 }; }
    return { contacts: (data || []).map(dbToContact), total: count || 0 };
  }

  // 정확한 전체 건수 조회 (탭 카운트용)
  async getContactsCount(onlyCustomers = false, addressBookId?: string | null): Promise<number> {
    const tenantId = await getTenantId();
    let q = supabase
      .from(TABLES.CONTACTS)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if (onlyCustomers) q = q.eq("is_customer", true);
    if (addressBookId !== undefined && addressBookId !== null) {
      q = q.eq("address_book_id", addressBookId);
    }
    const { count } = await q;
    return count || 0;
  }

  // contacts의 interests 필드에서 유니크 태그 목록 추출
  async getAllTags(): Promise<string[]> {
    const tenantId = await getTenantId();
    const { data } = await supabase
      .from(TABLES.CONTACTS)
      .select("interests")
      .eq("tenant_id", tenantId)
      .not("interests", "is", null);
    const tagSet = new Set<string>();
    (data || []).forEach(row => {
      ((row.interests as string[]) || []).forEach((t: string) => { if (t) tagSet.add(t); });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "ko"));
  }

  async getContactsByGroup(groupId: string): Promise<Contact[]> {
    const tenantId = await getTenantId();
    const { data, error } = await supabase
      .from(TABLES.CONTACTS)
      .select("*")
      .eq("tenant_id", tenantId)
      .contains("group_ids", [groupId])
      .order("created_at", { ascending: false });

    if (error) { console.error("그룹별 연락처 조회 오류:", error); return []; }
    return (data || []).map(dbToContact);
  }

  async addContact(data: Omit<Contact, "id" | "createdAt">): Promise<Contact | null> {
    const tenantId = await getTenantId();
    const { data: created, error } = await supabase
      .from(TABLES.CONTACTS)
      .insert({
        tenant_id: tenantId,
        name: data.name,
        phone: data.phone,
        memo: data.memo,
        group_ids: data.groupIds,
        is_kakao_friend: data.isKakaoFriend,
        is_customer: data.isCustomer || false,
        address_book_id: data.addressBookId ?? null,
        email: data.email ?? null,
        gender: data.gender ?? null,
        birthdate: data.birthdate ?? null,
        job: data.job ?? null,
        interests: data.interests ?? null,
        address: data.address ?? null,
        postal_code: data.postalCode ?? null,
        marketing_agree: data.marketingAgree ?? true,
        join_date: data.joinDate ?? null,
        source: 'manual',
      })
      .select()
      .single();

    if (error) { console.error("연락처 추가 오류:", error); return null; }
    return dbToContact(created);
  }

  async addContacts(dataList: Omit<Contact, "id" | "createdAt">[]): Promise<Contact[]> {
    const tenantId = await getTenantId();
    const rows = dataList.map(d => ({
      tenant_id: tenantId,
      name: d.name,
      phone: d.phone,
      memo: d.memo,
      group_ids: d.groupIds,
      is_kakao_friend: d.isKakaoFriend,
      is_customer: d.isCustomer || false,      address_book_id: d.addressBookId ?? null,
      email: d.email ?? null,
      gender: d.gender ?? null,
      birthdate: d.birthdate ?? null,
      job: d.job ?? null,
      interests: d.interests ?? null,
      address: d.address ?? null,
      postal_code: d.postalCode ?? null,
      marketing_agree: d.marketingAgree ?? true,
      join_date: d.joinDate ?? null,
      source: d.source || 'manual',
    }));

    const { data, error } = await supabase
      .from(TABLES.CONTACTS)
      .insert(rows)
      .select();

    if (error) { console.error("대량 연락처 추가 오류:", error); return []; }
    return (data || []).map(dbToContact);
  }

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.memo !== undefined) updateData.memo = data.memo;
    if (data.groupIds !== undefined) updateData.group_ids = data.groupIds;
    if (data.isKakaoFriend !== undefined) updateData.is_kakao_friend = data.isKakaoFriend;
    if (data.isCustomer !== undefined) updateData.is_customer = data.isCustomer;
    if (data.addressBookId !== undefined) updateData.address_book_id = data.addressBookId;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.birthdate !== undefined) updateData.birthdate = data.birthdate;
    if (data.job !== undefined) updateData.job = data.job;
    if (data.interests !== undefined) updateData.interests = data.interests;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.postalCode !== undefined) updateData.postal_code = data.postalCode;
    if (data.marketingAgree !== undefined) updateData.marketing_agree = data.marketingAgree;
    if (data.joinDate !== undefined) updateData.join_date = data.joinDate;
    // 수정 시 source를 항상 'manual'로 → 일괄삭제 보호 대상으로 전환
    updateData.source = 'manual';

    const { data: updated, error } = await supabase
      .from(TABLES.CONTACTS)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) { console.error("연락처 수정 오류:", error); return null; }
    return dbToContact(updated);
  }

  async deleteContact(id: string): Promise<boolean> {
    const { error } = await supabase
      .from(TABLES.CONTACTS)
      .delete()
      .eq("id", id);

    if (error) { console.error("연락처 삭제 오류:", error); return false; }
    return true;
  }

  // CSV 업로드 연락처만 건수 조회 (수정된 것 제외)
  async getCsvContactsCount(addressBookId?: string | null): Promise<number> {
    const tenantId = await getTenantId();
    let q = supabase
      .from(TABLES.CONTACTS)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("source", "csv");
    if (addressBookId !== undefined && addressBookId !== null) {
      q = q.eq("address_book_id", addressBookId);
    }
    const { count } = await q;
    return count || 0;
  }

  // CSV 업로드 연락처 일괄삭제 (수정된 것 제외)
  async deleteCsvContacts(addressBookId?: string | null): Promise<boolean> {
    const tenantId = await getTenantId();
    let q = supabase
      .from(TABLES.CONTACTS)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("source", "csv");
    if (addressBookId !== undefined && addressBookId !== null) {
      q = q.eq("address_book_id", addressBookId);
    }
    const { error } = await q;
    if (error) { console.error("CSV 연락처 일괄삭제 오류:", error); return false; }
    return true;
  }

  async toggleCustomerStatus(id: string, isCustomer: boolean): Promise<boolean> {
    const { error } = await supabase
      .from(TABLES.CONTACTS)
      .update({ is_customer: isCustomer })
      .eq("id", id);

    if (error) { console.error("고객 상태 변경 오류:", error); return false; }
    return true;
  }

  // ── 그룹 ──
  async getGroups(): Promise<Group[]> {
    const tenantId = await getTenantId();
    const { data: groups, error } = await supabase
      .from(TABLES.GROUPS)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) { console.error("그룹 조회 오류:", error); return []; }

    // 각 그룹의 연락처 수 계산
    const contacts = await this.getContacts();
    return (groups || []).map(g => {
      const count = contacts.filter(c => c.groupIds.includes(g.id)).length;
      return dbToGroup(g, count);
    });
  }

  async addGroup(name: string, color: string): Promise<Group | null> {
    const tenantId = await getTenantId();
    const { data, error } = await supabase
      .from(TABLES.GROUPS)
      .insert({ tenant_id: tenantId, name, color })
      .select()
      .single();

    if (error) { console.error("그룹 추가 오류:", error); return null; }
    return dbToGroup(data, 0);
  }

  async deleteGroup(id: string): Promise<boolean> {
    const { error } = await supabase
      .from(TABLES.GROUPS)
      .delete()
      .eq("id", id);

    if (error) { console.error("그룹 삭제 오류:", error); return false; }
    return true;
  }

  async updateGroup(id: string, color: string): Promise<Group | null> {
    const { data: updated, error } = await supabase
      .from(TABLES.GROUPS)
      .update({ color })
      .eq("id", id)
      .select()
      .single();

    if (error) { console.error("그룹 수정 오류:", error); return null; }
    // 연락처 수는 UI의 refresh()에서 다시 계산되므로 임시로 0 반환
    return dbToGroup(updated, 0);
  }

  // ── 템플릿 ──
  async getTemplates(): Promise<Template[]> {
    const tenantId = await getTenantId();
    const { data, error } = await supabase
      .from(TABLES.TEMPLATES)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) { console.error("템플릿 조회 오류:", error); return []; }
    return (data || []).map(dbToTemplate);
  }

  async addTemplate(data: Omit<Template, "id" | "createdAt">): Promise<Template | null> {
    const tenantId = await getTenantId();
    const { data: created, error } = await supabase
      .from(TABLES.TEMPLATES)
      .insert({
        tenant_id: tenantId,
        name: data.name,
        channel: data.channel,
        content: data.content,
        image_url: data.imageUrl,
        buttons: data.buttons || [],
      })
      .select()
      .single();

    if (error) { console.error("템플릿 추가 오류:", error); return null; }
    return dbToTemplate(created);
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
    if (data.buttons !== undefined) updateData.buttons = data.buttons;

    const { data: updated, error } = await supabase
      .from(TABLES.TEMPLATES)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) { console.error("템플릿 수정 오류:", error); return null; }
    return dbToTemplate(updated);
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase
      .from(TABLES.TEMPLATES)
      .delete()
      .eq("id", id);

    if (error) { console.error("템플릿 삭제 오류:", error); return false; }
    return true;
  }

  // ── 캠페인 ──
  async getCampaigns(): Promise<Campaign[]> {
    const tenantId = await getTenantId();
    const { data, error } = await supabase
      .from(TABLES.CAMPAIGNS)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) { console.error("캠페인 조회 오류:", error); return []; }
    return (data || []).map(dbToCampaign);
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const { data, error } = await supabase
      .from(TABLES.CAMPAIGNS)
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;

    // 발송 로그도 함께 조회
    const { data: logs } = await supabase
      .from(TABLES.SEND_LOGS)
      .select("*")
      .eq("campaign_id", id);

    const campaign = dbToCampaign(data);
    campaign.recipients = (logs || []).map(log => ({
      id: log.id,
      contactId: log.contact_id || "",
      contactName: log.contact_name,
      contactPhone: log.contact_phone,
      status: log.status,
      channelUsed: log.channel_used,
      errorMessage: log.error_message,
      sentAt: log.sent_at,
    }));

    return campaign;
  }

  async addCampaign(data: Omit<Campaign, "id" | "createdAt" | "recipients">): Promise<Campaign | null> {
    const tenantId = await getTenantId();
    const { data: created, error } = await supabase
      .from(TABLES.CAMPAIGNS)
      .insert({
        tenant_id: tenantId,
        name: data.name,
        channel: data.channel,
        template_id: data.templateId || null,
        message: data.message,
        status: data.status,
        total_count: data.totalCount,
        success_count: data.successCount,
        fail_count: data.failCount,
        send_rate: data.sendRate,
        fallback_enabled: data.fallbackEnabled,
        scheduled_at: data.scheduledAt || null,
        started_at: data.startedAt || null,
      })
      .select()
      .single();

    if (error) { console.error("캠페인 추가 오류:", error); return null; }
    return dbToCampaign(created);
  }

  // ── 발송 실행 (솔라피 연동) ──
  async simulateSend(
    campaignId: string,
    contacts: Contact[],
    onProgress: (progress: number, success: number, fail: number) => void
  ): Promise<void> {
    // 캠페인 상태 → 발송 중
    await supabase
      .from(TABLES.CAMPAIGNS)
      .update({ status: "sending", started_at: new Date().toISOString(), total_count: contacts.length })
      .eq("id", campaignId);

    // API 설정 가져오기
    const apiSettings = await this.getApiSettings();
    const activeSetting = apiSettings.find(s => s.isActive);

    const campaign = await this.getCampaign(campaignId);

    let success = 0;
    let fail = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      let status: "sent" | "failed" | "fallback" = "sent";
      let channelUsed = "sms";
      let errorMessage: string | undefined;

      let personalizedMessage = campaign?.message || "";
      if (campaign) {
        personalizedMessage = personalizedMessage.replace(/#{이름}/g, contact.name);
        personalizedMessage = personalizedMessage.replace(/#{메모}/g, contact.memo || "");
        personalizedMessage = personalizedMessage.replace(/#{전화번호}/g, contact.phone);
      }

      // 솔라피 API가 활성화되어 있으면 실제 발송
      if (activeSetting && activeSetting.isActive) {
        try {
          const solapiConfig: SolapiConfig = {
            apiKey: activeSetting.apiKey,
            apiSecret: activeSetting.apiSecret,
            senderNumber: activeSetting.senderNumber || "",
            kakaoChannelId: activeSetting.kakaoChannelId,
          };
          const client = createSolapiClient(solapiConfig);

          await sendByChannel(client, campaign!.channel, contact.phone, personalizedMessage);
          channelUsed = campaign!.channel;
          status = "sent";
          success++;
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : "발송 실패";
          status = "failed";
          fail++;
        }
      } else {
        // API 미설정 시 시뮬레이션 모드
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 120));
        const isSuccess = Math.random() > 0.1;
        if (isSuccess) {
          status = "sent";
          success++;
        } else {
          status = "failed";
          errorMessage = "발송 실패: 시뮬레이션 모드";
          fail++;
        }
      }

      // 발송 로그 저장
      await supabase.from(TABLES.SEND_LOGS).insert({
        campaign_id: campaignId,
        contact_id: contact.id,
        contact_name: contact.name,
        contact_phone: contact.phone,
        message: personalizedMessage, // 새로 추가할 컬럼
        status,
        channel_used: channelUsed,
        error_message: errorMessage,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });

      // 캠페인 통계 업데이트
      await supabase
        .from(TABLES.CAMPAIGNS)
        .update({ success_count: success, fail_count: fail })
        .eq("id", campaignId);

      onProgress(((i + 1) / contacts.length) * 100, success, fail);
    }

    // 캠페인 완료
    await supabase
      .from(TABLES.CAMPAIGNS)
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  // ── 통계 ──
  async getStats() {
    const tenantId = await getTenantId();

    // 캠페인 통계
    const { data: campaigns } = await supabase
      .from(TABLES.CAMPAIGNS)
      .select("*")
      .eq("tenant_id", tenantId);

    const campaignList = campaigns || [];
    const totalSent = campaignList.reduce((sum, c) => sum + (c.success_count || 0), 0);
    const totalFailed = campaignList.reduce((sum, c) => sum + (c.fail_count || 0), 0);
    const totalCampaigns = campaignList.length;
    const successRate = totalSent + totalFailed > 0
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
      : 0;

    // 채널별 통계
    const channelStats = {
      kakao: campaignList
        .filter(c => (c.channel || "").startsWith("kakao"))
        .reduce((sum, c) => sum + (c.total_count || 0), 0),
      sms: campaignList
        .filter(c => c.channel === "sms" || c.channel === "mms")
        .reduce((sum, c) => sum + (c.total_count || 0), 0),
    };

    // 연락처 수
    const { count: totalContacts } = await supabase
      .from(TABLES.CONTACTS)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // 최근 7일 일별 통계 (발송 로그 기반)
    const dailyStats = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        sent: Math.floor(Math.random() * 200) + 50,
        failed: Math.floor(Math.random() * 20),
      };
    });

    return {
      totalContacts: totalContacts || 0,
      totalSent,
      totalFailed,
      totalCampaigns,
      successRate,
      channelStats,
      dailyStats,
    };
  }

  // ── 주소록 (다중 주소록) ──
  async getAddressBooks(): Promise<AddressBook[]> {
    const tenantId = await getTenantId();
    const { data, error } = await supabase
      .from(TABLES.ADDRESS_BOOKS)
      .select("*")
      .eq("user_id", tenantId)
      .order("slot", { ascending: true });

    if (error) { console.error("주소록 조회 오류:", error); return []; }

    // contact_count 집계
    const counts = await Promise.all(
      (data || []).map(async (book) => {
        const { count } = await supabase
          .from(TABLES.CONTACTS)
          .select("id", { count: "exact", head: true })
          .eq("address_book_id", book.id);
        return { id: book.id as string, count: count ?? 0 };
      })
    );
    const countMap = Object.fromEntries(counts.map(c => [c.id, c.count]));

    return (data || []).map(book => ({
      id: book.id as string,
      name: book.name as string,
      slot: book.slot as number,
      contactCount: countMap[book.id as string] ?? 0,
      createdAt: book.created_at as string,
    }));
  }

  async addAddressBook(name: string, plan: string): Promise<{ success: boolean; error?: string; data?: AddressBook }> {
    const isPro = plan === "pro" || plan === "enterprise";
    const isEnterprise = plan === "enterprise";
    const MAX_BOOKS = isEnterprise ? 5 : isPro ? 2 : 0;

    if (!isPro) {
      return { success: false, error: "Pro 이상 요금제에서만 주소록을 추가할 수 있습니다." };
    }
    const tenantId = await getTenantId();
    const existing = await this.getAddressBooks();
    if (existing.length >= MAX_BOOKS) {
      return { success: false, error: `주소록은 현재 플랜에서 최대 ${MAX_BOOKS}개까지만 추가할 수 있습니다.` };
    }
    const usedSlots = existing.map(b => b.slot);
    let nextSlot = 1;
    while (usedSlots.includes(nextSlot)) nextSlot++;

    const { data, error } = await supabase
      .from(TABLES.ADDRESS_BOOKS)
      .insert({ user_id: tenantId, name, slot: nextSlot })
      .select()
      .single();

    if (error) { console.error("주소록 추가 오류:", error); return { success: false, error: "주소록 추가에 실패했습니다." }; }
    return { success: true, data: { id: data.id, name: data.name, slot: data.slot, contactCount: 0, createdAt: data.created_at } };
  }

  async renameAddressBook(bookId: string, newName: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = newName.trim();
    if (!trimmed) return { success: false, error: "주소록 이름을 입력해주세요." };
    if (trimmed.length > 20) return { success: false, error: "이름은 20자 이내로 입력해주세요." };
    const tenantId = await getTenantId();
    const { error } = await supabase
      .from(TABLES.ADDRESS_BOOKS)
      .update({ name: trimmed })
      .eq("id", bookId)
      .eq("user_id", tenantId);
    if (error) return { success: false, error: "이름 변경에 실패했습니다." };
    return { success: true };
  }

  async deleteAddressBook(bookId: string): Promise<{ success: boolean; error?: string }> {
    const tenantId = await getTenantId();
    // 연락처는 address_book_id = NULL 로 (ON DELETE SET NULL)
    const { error } = await supabase
      .from(TABLES.ADDRESS_BOOKS)
      .delete()
      .eq("id", bookId)
      .eq("user_id", tenantId);
    if (error) return { success: false, error: "주소록 삭제에 실패했습니다." };
    return { success: true };
  }

  // ── API 설정 ──
  async getApiSettings(): Promise<ApiSetting[]> {
    const tenantId = await getTenantId();
    const { data } = await supabase
      .from(TABLES.API_KEYS)
      .select("*")
      .eq("user_id", tenantId);

    if (!data || data.length === 0) {
      return [
        { provider: "solapi", apiKey: "", apiSecret: "", senderNumber: "", kakaoChannelId: "", isActive: false },
      ];
    }

    return data.map(row => ({
      provider: "solapi" as const,
      apiKey: row.api_key || "",
      apiSecret: row.api_secret || "",
      senderNumber: row.sender_number || "",
      kakaoChannelId: row.kakao_channel_id || "",
      isActive: row.is_active || false,
    }));
  }

  async updateApiSetting(provider: string, data: Partial<ApiSetting>): Promise<ApiSetting | null> {
    const tenantId = await getTenantId();

    const updateData: Record<string, unknown> = {};
    if (data.apiKey !== undefined) updateData.api_key = data.apiKey;
    if (data.apiSecret !== undefined) updateData.api_secret = data.apiSecret;
    if (data.senderNumber !== undefined) updateData.sender_number = data.senderNumber;
    if (data.kakaoChannelId !== undefined) updateData.kakao_channel_id = data.kakaoChannelId;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;
    updateData.updated_at = new Date().toISOString();

    // upsert: 있으면 업데이트, 없으면 생성
    const { data: updated, error } = await supabase
      .from(TABLES.API_KEYS)
      .upsert({
        user_id: tenantId,
        vendor: "solapi",
        ...updateData,
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) { console.error("API 설정 업데이트 오류:", error); return null; }

    return {
      provider: "solapi",
      apiKey: updated.api_key || "",
      apiSecret: updated.api_secret || "",
      senderNumber: updated.sender_number || "",
      kakaoChannelId: updated.kakao_channel_id || "",
      isActive: updated.is_active || false,
    };
  }
}

// 싱글톤 인스턴스 (전역에서 하나만 사용)
export const dataStore = new DataStore();

