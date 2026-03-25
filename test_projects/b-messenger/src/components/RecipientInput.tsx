// ================================================================
// components/RecipientInput.tsx — 수신자 입력 (태그 UI + 검증 + DB선택 + CSV)
// 그룹 탭: parent_id 기반 아코디언 트리 (최상/대/중/소)
// ================================================================
"use client";

import { useState, useRef, useCallback } from "react";
import { supabase, TABLES } from "@/lib/supabase";
import styles from "@/styles/RecipientInput.module.css";

export interface Recipient {
  name: string;
  phone: string;
  valid: boolean;
}

interface ContactRow {
  id: string;
  name: string;
  phone: string;
}

interface GroupRow {
  id: string;
  name: string;
  color: string;
  depth: number;
  path: string;
  parent_id: string | null;
  memberCount: number;
  children?: GroupRow[];
}

// depth → 레이블 / 색상
const DEPTH_LABELS: Record<number, string> = { 0: "최상", 1: "대", 2: "중", 3: "소" };
const DEPTH_COLORS: Record<number, string> = {
  0: "#818cf8",
  1: "#34d399",
  2: "#fbbf24",
  3: "#f87171",
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^01[016789]\d{7,8}$/.test(digits)) {
    if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  }
  return digits.length > 0 ? digits : raw.trim();
}

function isValidPhone(phone: string): boolean {
  return /^01[016789]-\d{3,4}-\d{4}$/.test(phone);
}

function parseLine(line: string): Recipient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const commaIdx = trimmed.indexOf(",");
  let name = "";
  let rawPhone = "";
  if (commaIdx !== -1) {
    name = trimmed.slice(0, commaIdx).trim();
    rawPhone = trimmed.slice(commaIdx + 1).trim();
  } else {
    const spaceMatch = trimmed.match(/^(.+?)\s+(01[016789][\d\s-]{7,})$/);
    if (spaceMatch) { name = spaceMatch[1].trim(); rawPhone = spaceMatch[2].trim(); }
    else { rawPhone = trimmed; }
  }
  const phone = normalizePhone(rawPhone);
  return { name, phone, valid: isValidPhone(phone) };
}

// flat list → parent_id 기반 트리
function buildTree(flat: GroupRow[]): GroupRow[] {
  const map = new Map<string, GroupRow>();
  flat.forEach(g => map.set(g.id, { ...g, children: [] }));
  const roots: GroupRow[] = [];
  map.forEach(g => {
    if (g.parent_id && map.has(g.parent_id)) {
      map.get(g.parent_id)!.children!.push(g);
    } else {
      roots.push(g);
    }
  });
  return roots;
}

interface Props {
  value: Recipient[];
  onChange: (recipients: Recipient[]) => void;
}

export default function RecipientInput({ value, onChange }: Props) {
  const [inputText, setInputText] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"contacts" | "groups">("contacts");

  // contacts 탭
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactsTotal, setContactsTotal] = useState<number | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);

  // groups 탭
  const [groupTree, setGroupTree] = useState<GroupRow[]>([]);
  const [groupsTotal, setGroupsTotal] = useState<number | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [memberCache, setMemberCache] = useState<Map<string, ContactRow[]>>(new Map());
  const [loadingGroupId, setLoadingGroupId] = useState<string | null>(null);

  // 선택 상태
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFromText = useCallback((text: string) => {
    const lines = text.split(/[\n;]+/);
    const newItems: Recipient[] = [];
    for (const line of lines) {
      const r = parseLine(line);
      if (r) newItems.push(r);
    }
    if (newItems.length > 0) {
      const existingPhones = new Set(value.map(v => v.phone));
      const unique = newItems.filter(r => !existingPhones.has(r.phone));
      onChange([...value, ...unique]);
    }
  }, [value, onChange]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Enter", "Tab", ","].includes(e.key)) {
      e.preventDefault();
      if (inputText.trim()) { addFromText(inputText); setInputText(""); }
    } else if (e.key === "Backspace" && inputText === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.includes("\n") || text.includes(";")) {
      e.preventDefault();
      addFromText(text);
      setInputText("");
    }
  }

  function handleBlur() {
    if (inputText.trim()) { addFromText(inputText); setInputText(""); }
  }

  function removeRecipient(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const startIdx = /01[016789]/.test(lines[0]) ? 0 : 1;
      const parsed: Recipient[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const r = parseLine(lines[i]);
        if (r) parsed.push(r);
      }
      if (parsed.length > 0) {
        const existingPhones = new Set(value.map(v => v.phone));
        onChange([...value, ...parsed.filter(r => !existingPhones.has(r.phone))]);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function openModal() {
    setShowModal(true);
    setSelected(new Set());
    setContactSearch("");
    setExpandedGroups(new Set());
    setMemberCache(new Map());
    setLoadingGroupId(null);
    await Promise.all([loadContacts(), loadGroups()]);
  }

  async function loadContacts() {
    setContactsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from(TABLES.CONTACTS)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", user.id);
      setContactsTotal(count ?? 0);

      const PAGE_SIZE = 1000;
      const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
      const allData: ContactRow[] = [];
      for (let page = 0; page < totalPages; page++) {
        const { data } = await supabase
          .from(TABLES.CONTACTS)
          .select("id, name, phone")
          .eq("tenant_id", user.id)
          .order("name")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (data) allData.push(...(data as ContactRow[]));
      }
      setContacts(allData);
    } finally {
      setContactsLoading(false);
    }
  }

  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 그룹 목록 — path 정렬로 트리 순서 보장
      const { data: groupData, count: gCount } = await supabase
        .from(TABLES.GROUPS)
        .select("id, name, color, parent_id, depth, path", { count: "exact" })
        .eq("tenant_id", user.id)
        .order("path", { ascending: true });
      setGroupsTotal(gCount ?? 0);
      if (!groupData) return;

      const groupIds = groupData.map((g) => g.id as string);

      // GROUP_MEMBER_COUNTS 뷰 (재귀 합산) 시도 → fallback GROUP_MEMBERS
      let countMap: Record<string, number> = {};
      const { data: counts, error: countErr } = await supabase
        .from(TABLES.GROUP_MEMBER_COUNTS)
        .select("group_id, total_member_count")
        .in("group_id", groupIds);

      if (!countErr && counts) {
        countMap = Object.fromEntries(
          counts.map((c) => [c.group_id as string, (c.total_member_count as number) ?? 0])
        );
      } else {
        const { data: members } = await supabase
          .from(TABLES.GROUP_MEMBERS)
          .select("group_id")
          .in("group_id", groupIds);
        (members ?? []).forEach((m) => {
          countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1;
        });
      }

      const flat: GroupRow[] = groupData.map((g) => ({
        id: g.id as string,
        name: g.name as string,
        color: (g.color as string) || "#667eea",
        depth: (g.depth as number) ?? 0,
        path: (g.path as string) ?? (g.id as string),
        parent_id: (g.parent_id as string | null) ?? null,
        memberCount: countMap[g.id as string] ?? 0,
      }));

      setGroupTree(buildTree(flat));
    } finally {
      setGroupsLoading(false);
    }
  }

  async function toggleGroup(groupId: string) {
    // 아코디언 토글
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) { next.delete(groupId); }
      else { next.add(groupId); }
      return next;
    });

    // 멤버 캐시에 없으면 GROUP_MEMBERS → CONTACTS 2-step 조회
    if (!memberCache.has(groupId)) {
      setLoadingGroupId(groupId);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setMemberCache(prev => new Map(prev).set(groupId, [])); return; }

        const { data: memberRows } = await supabase
          .from(TABLES.GROUP_MEMBERS)
          .select("contact_id")
          .eq("group_id", groupId);

        let members: ContactRow[] = [];
        if (memberRows && memberRows.length > 0) {
          const contactIds = memberRows.map((r) => r.contact_id as string);
          const { data: contactData } = await supabase
            .from(TABLES.CONTACTS)
            .select("id, name, phone")
            .in("id", contactIds)
            .order("name");
          members = (contactData as ContactRow[]) ?? [];
        }
        setMemberCache(prev => new Map(prev).set(groupId, members));
      } catch {
        setMemberCache(prev => new Map(prev).set(groupId, []));
      } finally {
        setLoadingGroupId(null);
      }
    }
  }

  function toggleAllGroupMembers(groupId: string) {
    const members = memberCache.get(groupId) ?? [];
    const ids = members.map(m => m.id);
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { ids.forEach(id => next.delete(id)); }
      else { ids.forEach(id => next.add(id)); }
      return next;
    });
  }

  function toggleItem(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirmSelection() {
    // contacts 탭 + 모든 그룹 멤버 캐시를 통합 풀로 사용
    const allPool = new Map<string, ContactRow>();
    contacts.forEach(c => allPool.set(c.id, c));
    memberCache.forEach(members => members.forEach(c => allPool.set(c.id, c)));

    const existingPhones = new Set(value.map(v => v.phone));
    const toAdd: Recipient[] = [];
    selected.forEach(id => {
      const c = allPool.get(id);
      if (!c) return;
      const phone = normalizePhone(c.phone);
      if (!existingPhones.has(phone)) {
        existingPhones.add(phone);
        toAdd.push({ name: c.name, phone, valid: isValidPhone(phone) });
      }
    });
    onChange([...value, ...toAdd]);
    setShowModal(false);
  }

  const filteredContacts = contacts.filter(c =>
    contactSearch === "" ||
    c.name.includes(contactSearch) ||
    c.phone.includes(contactSearch)
  );

  const invalidCount = value.filter(r => !r.valid).length;

  // ── 재귀 트리 노드 렌더링 (안 C: 계단식 margin-left + depth 컬러 연결선) ────────
  function renderGroupNode(g: GroupRow, depth = 0): React.ReactNode {
    const isExpanded = expandedGroups.has(g.id);
    const isLoading = loadingGroupId === g.id;
    const members = memberCache.get(g.id);
    const hasMemberData = members !== undefined;
    const allMembersSelected =
      hasMemberData && members!.length > 0 && members!.every(m => selected.has(m.id));
    const hasChildren = (g.children?.length ?? 0) > 0;
    const depthLabel = DEPTH_LABELS[g.depth] ?? `L${g.depth}`;
    const depthColor = DEPTH_COLORS[g.depth] ?? "#94a3b8";
    // 최상 depth는 12px, 중첩 내부(border-left 박스 안)는 14px 고정 — 계단은 margin-left 누적으로 형성
    const rowPadLeft = depth === 0 ? 12 : 14;

    return (
      <div key={g.id} className={styles.treeNodeWrap}>
        {/* 그룹 행 */}
        <div
          className={`${styles.treeGroupRow} ${isExpanded ? styles.treeGroupRowExpanded : ""}`}
          style={{ paddingLeft: rowPadLeft }}
          onClick={() => toggleGroup(g.id)}
        >
          <span className={`${styles.treeToggle} ${isExpanded ? styles.treeToggleOpen : ""}`}>
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className={styles.treeColorDot} style={{ background: g.color }} />
          <span
            className={styles.treeDepthBadge}
            style={{ background: depthColor + "22", color: depthColor, borderColor: depthColor + "55" }}
          >
            {depthLabel}
          </span>
          <span className={styles.treeGroupName}>{g.name}</span>
          <span className={styles.treeCountBadge}>{g.memberCount.toLocaleString()}명</span>
        </div>

        {/* 펼쳐진 경우 — depth 컬러 연결선 박스로 감쌈 */}
        {isExpanded && (
          <div className={styles.treeChildren} style={{ borderLeftColor: depthColor + "55" }}>
            {hasChildren && g.children!.map(child => renderGroupNode(child, depth + 1))}

            <div className={styles.treeMemberSection}>
              {isLoading ? (
                <div className={styles.treeLoadingRow}>멤버 불러오는 중…</div>
              ) : !hasMemberData ? null
              : members!.length === 0 ? (
                <div className={styles.treeLoadingRow}>직접 멤버 없음</div>
              ) : (
                <>
                  {/* 전체 선택 */}
                  <div
                    className={`${styles.memberItem} ${styles.memberSelectAll}`}
                    onClick={e => { e.stopPropagation(); toggleAllGroupMembers(g.id); }}
                  >
                    <div className={`${styles.dbItemCheck} ${allMembersSelected ? styles.dbItemCheckActive : ""}`}>
                      {allMembersSelected ? "✓" : ""}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#a5b4fc" }}>
                      {allMembersSelected ? "전체 해제" : `전체 선택 (${members!.length}명)`}
                    </span>
                  </div>
                  {/* 멤버 행 */}
                  {members!.map(m => {
                    const isSel = selected.has(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`${styles.memberItem} ${isSel ? styles.selected : ""}`}
                        onClick={e => { e.stopPropagation(); toggleItem(m.id); }}
                      >
                        <div className={`${styles.dbItemCheck} ${isSel ? styles.dbItemCheckActive : ""}`}>
                          {isSel ? "✓" : ""}
                        </div>
                        <span className={styles.dbItemName}>{m.name}</span>
                        <span className={styles.dbItemPhone}>{m.phone}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={openModal}>
          👥 주소록 / 그룹에서 선택
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
          📂 CSV 업로드
        </button>
        {value.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", marginLeft: "auto" }}
            onClick={() => onChange([])}
          >
            전체 삭제
          </button>
        )}
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleCsvFile} />
      </div>

      <div
        className={`${styles.inputBox} ${invalidCount > 0 ? styles.hasError : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((r, i) => (
          <span
            key={i}
            className={`${styles.chip} ${r.valid ? styles.chipValid : styles.chipInvalid}`}
            title={r.valid ? `${r.name} ${r.phone}` : `⚠️ 번호 형식 오류: ${r.phone}`}
          >
            <span className={styles.chipText}>
              {r.name ? `${r.name} · ${r.phone}` : r.phone}
            </span>
            <button
              type="button"
              className={styles.chipRemove}
              onClick={(e) => { e.stopPropagation(); removeRecipient(i); }}
            >✕</button>
          </span>
        ))}
        <input
          ref={inputRef}
          className={styles.textInput}
          placeholder={value.length === 0 ? "010-1234-5678 입력 후 Enter, 또는 위 버튼 사용" : ""}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
        />
      </div>

      <div className={styles.footer}>
        <span>
          {invalidCount > 0
            ? <span className={styles.errorCount}>⚠️ 번호 오류 {invalidCount}건 — 수정 후 발송하세요</span>
            : value.length > 0
            ? <span style={{ color: "#4ade80" }}>✅ {value.length}명 정상</span>
            : <span>수신자를 추가해주세요</span>}
        </span>
        <span>{value.length}명</span>
      </div>

      {showModal && (
        <div className={styles.dbModalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className={styles.dbModal}>
            <div className={styles.dbModalTitle}>👥 수신자 선택</div>

            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === "contacts" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("contacts")}
              >
                📇 주소록 ({(contactsTotal ?? contacts.length).toLocaleString()})
              </button>
              <button
                className={`${styles.tab} ${activeTab === "groups" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("groups")}
              >
                👥 그룹 ({(groupsTotal ?? groupTree.length).toLocaleString()})
              </button>
            </div>

            {activeTab === "contacts" && (
              <>
                <input
                  className={styles.dbSearch}
                  placeholder="이름 또는 번호로 검색…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  autoFocus
                />
                <div className={styles.dbList}>
                  {contactsLoading ? (
                    <div className={styles.dbEmpty}>불러오는 중…</div>
                  ) : filteredContacts.length === 0 ? (
                    <div className={styles.dbEmpty}>
                      {contactSearch ? `'${contactSearch}' 검색 결과 없음` : "주소록이 비어있습니다"}
                    </div>
                  ) : (
                    filteredContacts.map(c => {
                      const isSel = selected.has(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`${styles.dbItem} ${isSel ? styles.selected : ""}`}
                          onClick={() => toggleItem(c.id)}
                        >
                          <div className={`${styles.dbItemCheck} ${isSel ? styles.dbItemCheckActive : ""}`}>{isSel ? "✓" : ""}</div>
                          <span className={styles.dbItemName}>{c.name}</span>
                          <span className={styles.dbItemPhone}>{c.phone}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {activeTab === "groups" && (
              <div className={styles.dbList}>
                {groupsLoading ? (
                  <div className={styles.dbEmpty}>불러오는 중…</div>
                ) : groupTree.length === 0 ? (
                  <div className={styles.dbEmpty}>그룹이 없습니다. 그룹 관리에서 먼저 만들어주세요.</div>
                ) : (
                  groupTree.map(g => renderGroupNode(g))
                )}
              </div>
            )}

            <div className={styles.dbModalFooter}>
              <span className={styles.selectionCount}>
                {selected.size > 0 ? `${selected.size}명 선택됨` : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>취소</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={confirmSelection}
                  disabled={selected.size === 0}
                >
                  {selected.size > 0 ? `${selected.size}명 추가` : "선택하세요"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
