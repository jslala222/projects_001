// ================================================================
// customers/page.tsx — 고객 관리 CRM 페이지 (PRO+)
// 클라이언트사이드 필터링: 그룹/태그 필터 정확 동작
// Faceted Dropdown UI — 100개 이상 그룹도 검색+스크롤
// ================================================================
"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { dataStore, Contact, Group, AddressBook } from "@/lib/store";
import { useAuth } from "@/components/AuthContext";
import AddressBookTabs from "@/components/AddressBookTabs";
import ContactAddModal from "@/components/ContactAddModal";
import { PlanGate } from "@/components/PlanGate";
import styles from "@/styles/contacts.module.css";

// ── Faceted Dropdown 컴포넌트 ──────────────────────────────────
interface FacetOption {
  id: string;
  label: string;
  color?: string;
  count: number;
}

interface FacetedDropdownProps {
  label: string;
  icon: string;
  options: FacetOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}

function FacetedDropdown({ label, icon, options, selected, onToggle, onClear }: FacetedDropdownProps) {
  const [open, setOpen] = useState(false);
  const [innerSearch, setInnerSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const shown = options.filter(o =>
    o.label.toLowerCase().includes(innerSearch.toLowerCase())
  );
  const cnt = selected.size;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 12px", borderRadius: 8,
          border: cnt > 0 ? "1px solid #818cf8" : "1px solid var(--border-primary)",
          background: cnt > 0 ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.04)",
          color: cnt > 0 ? "#a5b4fc" : "var(--text-secondary)",
          fontSize: 13, fontWeight: 500, cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
        {cnt > 0 && (
          <span style={{
            background: "#818cf8", color: "#fff",
            borderRadius: "50%", width: 18, height: 18,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
          }}>{cnt}</span>
        )}
        <span style={{ fontSize: 10, opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#1a1a2e", border: "1px solid var(--border-primary)",
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          minWidth: 240, maxWidth: 320,
        }}>
          <div style={{ padding: "10px 10px 6px" }}>
            <input
              type="text"
              placeholder="검색..."
              value={innerSearch}
              onChange={e => setInnerSearch(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "6px 10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border-primary)",
                borderRadius: 6, color: "#fff", fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          </div>
          {cnt > 0 && (
            <div style={{ padding: "2px 10px 6px" }}>
              <button
                onClick={() => { onClear(); setInnerSearch(""); }}
                style={{ fontSize: 11, color: "#f87171", background: "transparent", border: "none", cursor: "pointer", padding: "2px 0" }}
              >
                × 선택 해제 ({cnt}개)
              </button>
            </div>
          )}
          <div style={{ maxHeight: 280, overflowY: "auto", padding: "2px 4px 8px" }}>
            {shown.length === 0 ? (
              <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>검색 결과 없음</div>
            ) : (
              shown.map(opt => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                    background: selected.has(opt.id) ? "rgba(129,140,248,0.1)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(opt.id)}
                    onChange={() => onToggle(opt.id)}
                    style={{ cursor: "pointer", accentColor: opt.color || "#818cf8" }}
                  />
                  {opt.color && (
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
                  )}
                  <span style={{
                    flex: 1, fontSize: 13,
                    color: selected.has(opt.id) ? "#e2e8f0" : "var(--text-secondary)",
                    fontWeight: selected.has(opt.id) ? 600 : 400,
                  }}>
                    {opt.label}
                  </span>
                  <span style={{
                    fontSize: 11, color: "var(--text-secondary)",
                    background: "rgba(255,255,255,0.06)",
                    padding: "1px 6px", borderRadius: 10,
                  }}>
                    {opt.count}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function CustomersPage() {
  const { plan } = useAuth();

  // 서버사이드 페이지네이션 상태
  const [pagedCustomers, setPagedCustomers] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // 필터 상태 (다중선택)
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<
    "name_asc" | "name_desc" | "join_date_desc" | "join_date_asc" | "created_desc" | "created_asc"
  >("name_asc");
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  // UI 상태
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactId, setNewContactId] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#667eea");

  // ── 메타데이터 로드 (그룹/태그/주소록)
  const loadMeta = useCallback(async () => {
    const [grps, tags, books] = await Promise.all([
      dataStore.getGroups(),
      dataStore.getAllTags(),
      dataStore.getAddressBooks(),
    ]);
    setGroups(grps);
    setAllTags(tags);
    setAddressBooks(books);
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // ── 메인 연락처 로드 (서버사이드 페이지네이션 + 검색)
  const loadAll = useCallback(async () => { await loadMeta(); }, [loadMeta]);

  // ── 검색 debounce ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── 서버사이드 데이터 fetch ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sortMap: Record<typeof sortKey, { sortBy: "name" | "created_at" | "join_date"; sortDir: "asc" | "desc" }> = {
        name_asc:       { sortBy: "name",       sortDir: "asc"  },
        name_desc:      { sortBy: "name",       sortDir: "desc" },
        join_date_desc: { sortBy: "join_date",  sortDir: "desc" },
        join_date_asc:  { sortBy: "join_date",  sortDir: "asc"  },
        created_desc:   { sortBy: "created_at", sortDir: "desc" },
        created_asc:    { sortBy: "created_at", sortDir: "asc"  },
      };
      const { sortBy, sortDir } = sortMap[sortKey];
      const filterGroupIds = selectedGroups.size > 0 ? Array.from(selectedGroups) : undefined;
      const filterTags     = selectedTags.size > 0   ? Array.from(selectedTags)   : undefined;

      const result = await dataStore.getContactsPaged(
        currentPage, PAGE_SIZE, false,
        activeBookId,
        debouncedSearch,
        sortBy, sortDir,
        filterGroupIds,
        filterTags,
      );
      if (!cancelled) {
        setPagedCustomers(result.contacts);
        setTotalCount(result.total);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentPage, debouncedSearch, activeBookId, selectedGroups, selectedTags, sortKey]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const pagedContacts = pagedCustomers;

  const hasFilter = !!activeBookId || selectedGroups.size > 0 || selectedTags.size > 0 || search.trim().length > 0;

  function resetPage() { setCurrentPage(0); }

  function toggleGroup(id: string) {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    resetPage();
  }

  function toggleTag(id: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    resetPage();
  }

  function clearAll() {
    setActiveBookId(null);
    setSelectedGroups(new Set());
    setSelectedTags(new Set());
    setSearch("");
    resetPage();
  }

  function openEditModal(contact: Contact) {
    setExpandedId(null);
    setEditContact(contact);
    setShowEditModal(true);
  }

  function toggleExpand(contact: Contact) {
    setExpandedId(prev => prev === contact.id ? null : contact.id);
  }

  async function handleDelete(id: string) {
    if (confirm("연락처를 삭제하시겠습니까?")) {
      await dataStore.deleteContact(id);
      loadAll();
    }
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    await dataStore.addGroup(newGroupName.trim(), newGroupColor);
    setNewGroupName("");
    loadAll();
  }

  async function handleDeleteGroup(id: string) {
    if (confirm("그룹을 삭제하면 해당 그룹에 속했던 연락처의 분류 정보만 초기화됩니다. 계속하시겠습니까?")) {
      await dataStore.deleteGroup(id);
      loadAll();
    }
  }

  function getGroupColor(groupId: string): string {
    return groups.find(g => g.id === groupId)?.color || "#667eea";
  }

  function getGroupName(groupId: string): string {
    return groups.find(g => g.id === groupId)?.name || "미지정";
  }

  const groupOptions: FacetOption[] = groups.map(g => ({
    id: g.id, label: g.name, color: g.color,
    count: g.contactCount ?? 0,
  }));

  const tagOptions: FacetOption[] = allTags.map(t => ({
    id: t, label: t,
    count: 0,
  }));

  return (
    <PlanGate require="pro" feature="고객 관리">
    <div className={styles.contactsPage}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">💎 고객 관리</h1>
          <p className="page-subtitle">
            저장된 연락처 {totalCount}명
            {hasFilter && <span style={{ color: "#818cf8", marginLeft: 8 }}>→ 필터 적용 중 {totalCount}명</span>}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowGroupModal(true)}>
          🏷️ 그룹 관리
        </button>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ 연락처 추가
        </button>
      </div>

      {/* 주소록 탭 — 삭제 기능 없이 조회/필터 전용 */}
      <AddressBookTabs
        books={addressBooks}
        totalCount={totalCount}
        activeBookId={activeBookId}
        plan={plan || "free"}
        onTabChange={(bookId) => { setActiveBookId(bookId); resetPage(); }}
        onBooksChange={loadAll}
      />

      {/* 필터 툴바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 0 6px" }}>
        {/* 검색 */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
          <input
            type="text"
            placeholder="이름 또는 전화번호..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            style={{
              width: "100%", padding: "7px 12px 7px 32px",
              background: "rgba(255,255,255,0.04)",
              border: search ? "1px solid #818cf8" : "1px solid var(--border-primary)",
              borderRadius: 8, color: "#fff", fontSize: 13, boxSizing: "border-box",
            }}
          />
        </div>

        {/* 그룹 Faceted Dropdown */}
        {groupOptions.length > 0 && (
          <FacetedDropdown
            label="그룹" icon="🏷️"
            options={groupOptions}
            selected={selectedGroups}
            onToggle={toggleGroup}
            onClear={() => { setSelectedGroups(new Set()); resetPage(); }}
          />
        )}

        {/* 태그 Faceted Dropdown */}
        {tagOptions.length > 0 && (
          <FacetedDropdown
            label="태그" icon="#️⃣"
            options={tagOptions}
            selected={selectedTags}
            onToggle={toggleTag}
            onClear={() => { setSelectedTags(new Set()); resetPage(); }}
          />
        )}

        {/* 정렬 */}
        <select
          value={sortKey}
          onChange={e => { setSortKey(e.target.value as typeof sortKey); resetPage(); }}
          style={{
            padding: "7px 10px", borderRadius: 8,
            border: "1px solid var(--border-primary)",
            background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)",
            fontSize: 13, cursor: "pointer",
          }}
        >
          <option value="name_asc">이름순</option>
          <option value="name_desc">이름 역순</option>
          <option value="join_date_desc">가입일 최신</option>
          <option value="join_date_asc">가입일 오래된순</option>
          <option value="created_desc">등록일 최신</option>
          <option value="created_asc">등록일 오래된순</option>
        </select>

        {/* 초기화 */}
        {hasFilter && (
          <button
            onClick={clearAll}
            style={{
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid #f87171", color: "#f87171",
              background: "rgba(248,113,113,0.08)", fontSize: 13,
              cursor: "pointer", fontWeight: 600,
            }}
          >
            × 초기화
          </button>
        )}
      </div>

      {/* 활성 필터 뱃지 */}
      {hasFilter && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 8 }}>
          {Array.from(selectedGroups).map(gId => {
            const g = groups.find(x => x.id === gId);
            return g ? (
              <span key={gId} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 8px 3px 10px", borderRadius: 20,
                background: `${g.color}22`, border: `1px solid ${g.color}60`,
                color: g.color, fontSize: 12, fontWeight: 600,
              }}>
                {g.name}
                <button onClick={() => toggleGroup(gId)} style={{ background: "transparent", border: "none", color: g.color, cursor: "pointer", padding: 0, fontSize: 13 }}>×</button>
              </span>
            ) : null;
          })}
          {Array.from(selectedTags).map(tag => (
            <span key={tag} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px 3px 10px", borderRadius: 20,
              background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)",
              color: "#818cf8", fontSize: 12, fontWeight: 600,
            }}>
              #{tag}
              <button onClick={() => toggleTag(tag)} style={{ background: "transparent", border: "none", color: "#818cf8", cursor: "pointer", padding: 0, fontSize: 13 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* 고객 테이블 */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>로딩 중...</div>
        ) : (
        <table className={styles.contactTable}>
          <thead>
            <tr>
              <th>이름</th>
              <th>전화번호</th>
              <th>이메일</th>
              <th>성별</th>
              <th>가입일</th>
              <th>그룹</th>
              <th>카카오톡</th>
              <th>메모</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {pagedContacts.map((contact) => {
              const isExpanded = expandedId === contact.id;
              const isNew = newContactId === contact.id;
              return (
                <Fragment key={contact.id}>
                  <tr
                    className={`${styles.rowClickable} ${isExpanded ? styles.rowExpanded : ""} ${isNew ? styles.rowNew : ""}`}
                    onClick={() => toggleExpand(contact)}
                  >
                    <td>
                      <span className={styles.contactName}>{contact.name}</span>
                      {isNew && <span className={styles.newBadge}>🆕 NEW</span>}
                    </td>
                    <td><span className={styles.contactPhone}>{contact.phone}</span></td>
                    <td><span className={styles.cellSecondary}>{contact.email || "—"}</span></td>
                    <td><span className={styles.cellSecondary}>{contact.gender === "male" ? "남성" : contact.gender === "female" ? "여성" : "—"}</span></td>
                    <td>
                      <span
                        className={styles.cellSecondary}
                        title={`등록일: ${contact.createdAt ? contact.createdAt.slice(0, 10) : "—"}`}
                        style={{ cursor: "help" }}
                      >{contact.joinDate || "—"}</span>
                    </td>
                    <td>
                      <div className={styles.groupTags}>
                        {contact.groupIds.map((gId) => (
                          <span
                            key={gId}
                            className={styles.groupTag}
                            style={{ background: getGroupColor(gId), cursor: "pointer" }}
                            title="클릭하여 이 그룹 필터"
                            onClick={e => { e.stopPropagation(); toggleGroup(gId); }}
                          >
                            {getGroupName(gId)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.kakaoIcon} ${contact.isKakaoFriend ? styles.kakaoYes : styles.kakaoNo}`}>
                        {contact.isKakaoFriend ? "💬 친구" : "— 비친구"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{contact.memo || "—"}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openEditModal(contact); }} title="수정">✏️</button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }} title="삭제">🗑️</button>
                      </div>
                    </td>
                  </tr>

                  {/* 아코디언 상세 카드 */}
                  {isExpanded && (
                    <tr className={styles.expandRow}>
                      <td colSpan={9} className={styles.expandCell}>
                        <div className={styles.inlineCard}>
                          {/* 좌측: 아바타 + 이름 + 배지 */}
                          <div className={styles.inlineCardLeft}>
                            <div className={styles.inlineAvatar}>{contact.name.charAt(0)}</div>
                            <div className={styles.inlineCardName}>{contact.name}</div>
                            <div className={styles.inlineBadges}>
                              {contact.isKakaoFriend && <span className={styles.inlineBadge} style={{ background: "rgba(254,200,0,0.15)", color: "#ca8a04" }}>💬 카카오</span>}
                              {contact.marketingAgree && <span className={styles.inlineBadge} style={{ background: "rgba(34,197,94,0.15)", color: "#16a34a" }}>📣 마케팅</span>}
                            </div>
                          </div>

                          {/* 우측: 필드 그리드 */}
                          <div className={styles.inlineCardFields}>
                            {contact.phone && (
                              <div className={styles.inlineField}>
                                <span className={styles.inlineFieldLabel}>📱 전화</span>
                                <span className={styles.inlineFieldValue}>{contact.phone}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className={styles.inlineField}>
                                <span className={styles.inlineFieldLabel}>📧 이메일</span>
                                <span className={styles.inlineFieldValue}>{contact.email}</span>
                              </div>
                            )}
                            {contact.gender && (
                              <div className={styles.inlineField}>
                                <span className={styles.inlineFieldLabel}>👤 성별</span>
                                <span className={styles.inlineFieldValue}>{contact.gender === "male" ? "남성" : "여성"}</span>
                              </div>
                            )}
                            {contact.birthdate && (
                              <div className={styles.inlineField}>
                                <span className={styles.inlineFieldLabel}>🎂 생년월일</span>
                                <span className={styles.inlineFieldValue}>{contact.birthdate}</span>
                              </div>
                            )}
                            {contact.job && (
                              <div className={styles.inlineField}>
                                <span className={styles.inlineFieldLabel}>🏢 구분</span>
                                <span className={styles.inlineFieldValue}>{contact.job}</span>
                              </div>
                            )}
                            {contact.joinDate && (
                              <div className={styles.inlineField}>
                                <span className={styles.inlineFieldLabel}>📅 가입일</span>
                                <span className={styles.inlineFieldValue}>{contact.joinDate}</span>
                              </div>
                            )}
                            {(contact.address || contact.postalCode) && (
                              <div className={`${styles.inlineField} ${styles.inlineFieldFull}`}>
                                <span className={styles.inlineFieldLabel}>📍 주소</span>
                                <span className={styles.inlineFieldValue}>
                                  {contact.postalCode ? `(${contact.postalCode}) ` : ""}{contact.address}
                                </span>
                              </div>
                            )}
                            {contact.interests && contact.interests.length > 0 && (
                              <div className={`${styles.inlineField} ${styles.inlineFieldFull}`}>
                                <span className={styles.inlineFieldLabel}>🏷️ 관심사</span>
                                <div className={styles.inlineTagList}>
                                  {contact.interests.map(t => (
                                    <span key={t} className={styles.inlineTag}>{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {contact.memo && (
                              <div className={`${styles.inlineField} ${styles.inlineFieldFull}`}>
                                <span className={styles.inlineFieldLabel}>💬 메모</span>
                                <span className={styles.inlineFieldValue}>{contact.memo}</span>
                              </div>
                            )}
                          </div>

                          {/* 액션 버튼 */}
                          <div className={styles.inlineCardActions}>
                            <button
                              className={styles.inlineEditBtn}
                              onClick={(e) => { e.stopPropagation(); openEditModal(contact); }}
                            >✏️ 수정</button>
                            <button
                              className={styles.inlineDeleteBtn}
                              onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}
                            >🗑️ 삭제</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {pagedContacts.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-icon">{hasFilter ? "🔍" : "💎"}</div>
                    <div className="empty-state-title">{hasFilter ? "필터 조건에 맞는 고객이 없습니다" : "등록된 고객이 없습니다"}</div>
                    <div className="empty-state-desc">
                      {hasFilter ? (
                        <button onClick={clearAll} style={{ color: "#818cf8", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>필터 초기화</button>
                      ) : "주소록에서 별표(☆)를 눌러 고객으로 등록하세요"}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}

        {/* 페이지네이션 */}
        {totalCount > PAGE_SIZE && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>◄◄</button>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>◄</button>
            <span className={styles.pageInfo}>
              <strong>{currentPage + 1}</strong> / {totalPages}
              <span className={styles.pageTotal}> ({totalCount.toLocaleString()}명)</span>
            </span>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>▶</button>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>▶▶</button>
          </div>
        )}
      </div>

      {/* 새 연락처 추가 모달 */}
      {showAddModal && (
        <ContactAddModal
          activeBookId={activeBookId}
          activeBookName={activeBookId ? (addressBooks.find(b => b.id === activeBookId)?.name ?? "고객 관리") : "고객 관리"}
          addressBooks={addressBooks}
          onClose={() => setShowAddModal(false)}
          onSaved={async (id) => {
            setShowAddModal(false);
            await loadAll();
            if (id) {
              setNewContactId(id);
              setSortKey("created_desc");
              setCurrentPage(0);
              setTimeout(() => setNewContactId(null), 5000);
            }
          }}
          onAdd={(data) => dataStore.addContact(data)}
          onEdit={(id, data) => dataStore.updateContact(id, data)}
        />
      )}

      {/* 수정 모달 */}
      {showEditModal && editContact && (
        <ContactAddModal
          activeBookId={editContact.addressBookId ?? null}
          activeBookName="고객 관리"
          addressBooks={addressBooks}
          contactToEdit={editContact}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => { setShowEditModal(false); await loadAll(); }}
          onAdd={(data) => dataStore.addContact(data)}
          onEdit={(id, data) => dataStore.updateContact(id, data)}
        />
      )}



      {/* 그룹 관리 모달 */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>🏷️ 그룹 관리</h2>

            {/* 새 그룹 추가 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="새 그룹 이름"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={20}
              />
              <input
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                style={{ width: 44, height: 44, padding: 0, border: "none", borderRadius: 8, cursor: "pointer", background: "transparent" }}
                title="그룹 색상 선택"
              />
              <button className="btn btn-primary" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                추가
              </button>
            </div>

            {/* 기존 그룹 목록 */}
            <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border-primary)", borderRadius: 12, background: "rgba(0,0,0,0.1)" }}>
              {groups.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>생성된 그룹이 아직 없습니다.</div>
              )}
              {groups.map(g => (
                <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative", width: 16, height: 16, borderRadius: "50%", overflow: "hidden", background: g.color, cursor: "pointer", flexShrink: 0 }} title="색상 변경">
                      <input
                        type="color"
                        value={g.color}
                        onChange={async (e) => {
                          await dataStore.updateGroup(g.id, e.target.value);
                          loadAll();
                        }}
                        style={{ position: "absolute", top: -10, left: -10, width: 44, height: 44, padding: 0, border: "none", cursor: "pointer", opacity: 0 }}
                      />
                    </div>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      전체 {g.contactCount}명
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(g.id)}
                    style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: "4px 8px", fontSize: 13, fontWeight: 600 }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.modalActions} style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowGroupModal(false)} style={{ width: "100%" }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PlanGate>
  );
}
