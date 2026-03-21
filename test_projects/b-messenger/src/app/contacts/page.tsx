// ================================================================
// contacts/page.tsx — 주소록 관리 페이지
// 서버사이드 페이지네이션 (20건/페이지, 1000건 이상 지원)
// ================================================================
"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { dataStore, Contact, AddressBook } from "@/lib/store";
import { useAuth } from "@/components/AuthContext";
import AddressBookTabs from "@/components/AddressBookTabs";
import ContactAddModal from "@/components/ContactAddModal";
import CSVUploadModal from "@/components/CSVUploadModal";
import styles from "@/styles/contacts.module.css";
import { getGroups } from "@/app/actions/groups";
import type { Group } from "@/types";

const PAGE_SIZE = 20;

type SortOption = {
  label: string;
  sortBy: "name" | "created_at" | "join_date";
  sortDir: "asc" | "desc";
};

const SORT_OPTIONS: SortOption[] = [
  { label: "이름 가나다순", sortBy: "name", sortDir: "asc" },
  { label: "이름 역순", sortBy: "name", sortDir: "desc" },
  { label: "등록일 최신순", sortBy: "created_at", sortDir: "desc" },
  { label: "등록일 오래된순", sortBy: "created_at", sortDir: "asc" },
  { label: "가입일 최신순", sortBy: "join_date", sortDir: "desc" },
  { label: "가입일 오래된순", sortBy: "join_date", sortDir: "asc" },
];

export default function ContactsPage() {
  const { plan, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addressBooks, setAddressBooks] = useState<AddressBook[]>([]);
  const [totalContactCount, setTotalContactCount] = useState(0);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortIdx, setSortIdx] = useState(0); // 기본: 이름 가나다순
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 그룹/태그 필터 (Pro 이상)
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroupId, setFilterGroupId] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  // 2단계 경고: step1=경고확인, step2=텍스트입력확인
  const [deleteConfirm, setDeleteConfirm] = useState<{
    mode: "all" | "book";
    bookName?: string;
    bookId?: string;
    csvCount: number;
    step: 1 | 2;
    inputText: string;
  } | null>(null);

  const isPro = plan === "pro" || plan === "enterprise";

  // 그룹 목록 + 태그 목록 로드 (Pro 이상만)
  useEffect(() => {
    if (!authLoading && isPro) {
      getGroups().then(({ data }) => setGroups(data ?? []));
      dataStore.getAllTags().then(setAllTags);
    }
  }, [authLoading, isPro]);

  // 서버사이드 데이터 로드
  const loadData = useCallback(async (
    page: number,
    bookId: string | null,
    searchText: string,
    si: number,
    groupId: string | null,
    tag: string | null
  ) => {
    const { sortBy, sortDir } = SORT_OPTIONS[si];
    const [result, books, totalAll] = await Promise.all([
      dataStore.getContactsPaged(
        page, PAGE_SIZE, false, bookId, searchText, sortBy, sortDir,
        groupId ?? undefined,
        tag ? [tag] : undefined
      ),
      dataStore.getAddressBooks(),
      dataStore.getContactsCount(),
    ]);
    setContacts(result.contacts);
    setTotalFiltered(result.total);
    setAddressBooks(books);
    setTotalContactCount(totalAll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authLoading) return;
    loadData(currentPage, activeBookId, search, sortIdx, filterGroupId, filterTag);
  }, [currentPage, activeBookId, search, sortIdx, filterGroupId, filterTag, loadData, authLoading]);

  const refresh = useCallback(() => {
    loadData(currentPage, activeBookId, search, sortIdx, filterGroupId, filterTag);
  }, [loadData, currentPage, activeBookId, search, sortIdx, filterGroupId, filterTag]);

  // 탭 전환 시 페이지 초기화
  const handleTabChange = useCallback((bookId: string | null) => {
    setCurrentPage(0);
    setActiveBookId(bookId);
  }, []);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setCurrentPage(0);
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSortIdx(Number(e.target.value));
    setCurrentPage(0);
  }

  function handleGroupFilter(groupId: string | null) {
    setFilterGroupId(groupId);
    setCurrentPage(0);
  }

  function handleTagFilter(tag: string | null) {
    setFilterTag(tag);
    setCurrentPage(0);
  }

  function clearAllFilters() {
    setFilterGroupId(null);
    setFilterTag(null);
    setSearch("");
    setCurrentPage(0);
  }

  function openAddModal() {
    setEditContact(null);
    setShowAddModal(true);
  }

  function openEditModal(contact: Contact) {
    setExpandedId(null);
    setEditContact(contact);
    setShowAddModal(true);
  }

  function toggleExpand(contact: Contact) {
    setExpandedId(prev => prev === contact.id ? null : contact.id);
  }

  async function handleDelete(id: string) {
    if (confirm("정말 삭제하시겠습니까?")) {
      await dataStore.deleteContact(id);
      refresh();
    }
  }

  async function handleToggleCustomer(contact: Contact) {
    const success = await dataStore.toggleCustomerStatus(contact.id, !contact.isCustomer);
    if (success) refresh();
  }

  // CSV 일괄삭제 요청
  async function openDeleteConfirm(mode: "all" | "book", overrideBookId?: string) {
    const targetBookId = mode === "book" ? (overrideBookId ?? activeBookId) : undefined;
    const csvCount = await dataStore.getCsvContactsCount(targetBookId ?? undefined);
    const bookName = mode === "book" && targetBookId
      ? (addressBooks.find(b => b.id === targetBookId)?.name || "주소록")
      : undefined;
    setDeleteConfirm({ mode, bookName, bookId: targetBookId ?? undefined, csvCount, step: 1, inputText: "" });
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    await dataStore.deleteCsvContacts(deleteConfirm.bookId ?? null);
    setDeleteConfirm(null);
    setCurrentPage(0);
    refresh();
  }

  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE) || 1;

  return (
    <div className={styles.contactsPage}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📇 주소록</h1>
          <p className="page-subtitle">연락처를 관리하고 그룹으로 분류하세요</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
            📁 CSV 업로드
          </button>
          <button
            className="btn btn-secondary"
            style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}
            onClick={() => openDeleteConfirm("all")}
          >
            🗑️ 전체 CSV 삭제
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            ➕ 연락처 추가
          </button>
        </div>
      </div>

      {/* 다중 주소록 탭 */}
      <AddressBookTabs
        books={addressBooks}
        totalCount={totalContactCount}
        activeBookId={activeBookId}
        plan={plan}
        onTabChange={handleTabChange}
        onBooksChange={refresh}
        onDeleteCsvByBook={(bookId) => openDeleteConfirm("book", bookId)}
      />

      {/* 그룹/태그 필터 패널 (Pro 이상) */}
      {isPro && (groups.length > 0 || allTags.length > 0) && (
        <div style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "10px 0",
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>필터:</span>

          {/* 그룹 필터 */}
          {groups.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => handleGroupFilter(null)}
                style={{
                  fontSize: 12, padding: "4px 10px", borderRadius: 20,
                  border: "1px solid var(--border-light)",
                  background: !filterGroupId ? "var(--accent)" : "transparent",
                  color: !filterGroupId ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >전체</button>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => handleGroupFilter(filterGroupId === g.id ? null : g.id)}
                  style={{
                    fontSize: 12, padding: "4px 10px", borderRadius: 20,
                    border: `1px solid ${g.color}40`,
                    background: filterGroupId === g.id ? g.color : `${g.color}18`,
                    color: filterGroupId === g.id ? "#fff" : g.color,
                    cursor: "pointer",
                    fontWeight: filterGroupId === g.id ? 600 : 400,
                  }}
                >
                  {g.name} ({g.member_count ?? 0})
                </button>
              ))}
            </div>
          )}

          {/* 태그 필터 */}
          {allTags.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", margin: "0 4px" }}>|</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allTags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagFilter(filterTag === tag ? null : tag)}
                    style={{
                      fontSize: 12, padding: "4px 10px", borderRadius: 20,
                      border: "1px solid var(--border-light)",
                      background: filterTag === tag ? "#6366f1" : "transparent",
                      color: filterTag === tag ? "#fff" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 필터 초기화 */}
          {(filterGroupId || filterTag || search) && (
            <button
              onClick={clearAllFilters}
              style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 20,
                border: "1px solid #f87171",
                color: "#f87171", background: "transparent",
                cursor: "pointer", marginLeft: 4,
              }}
            >
              × 초기화
            </button>
          )}
        </div>
      )}

      {/* 검색 + 정렬 */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="이름 또는 전화번호로 검색..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <select
          className={styles.sortSelect}
          value={sortIdx}
          onChange={handleSortChange}
          title="정렬 방식 선택"
        >
          {SORT_OPTIONS.map((opt, i) => (
            <option key={i} value={i}>{opt.label}</option>
          ))}
        </select>
        {activeBookId && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, color: "#f87171", borderColor: "rgba(248,113,113,0.4)", whiteSpace: "nowrap" }}
            onClick={() => openDeleteConfirm("book")}
          >
            🗑️ {addressBooks.find(b => b.id === activeBookId)?.name || "이 주소록"} CSV 삭제
          </button>
        )}
      </div>

      {/* 연락처 테이블 */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <span className={styles.tableCount}>
            <strong>{totalFiltered}</strong>명의 연락처
          </span>
        </div>
        <table className={styles.contactTable}>
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>고객</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>이메일</th>
              <th>성별</th>
              <th>가입일</th>
              <th>카카오톡</th>
              <th>메모</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const isExpanded = expandedId === contact.id;
              return (
                <Fragment key={contact.id}>
                  <tr
                    className={`${contact.isCustomer ? styles.rowCustomer : ""} ${styles.rowClickable} ${isExpanded ? styles.rowExpanded : ""}`}
                    onClick={() => toggleExpand(contact)}
                  >
                    <td style={{ textAlign: "center" }}>
                      <button
                        className={styles.starBtn}
                        onClick={(e) => { e.stopPropagation(); handleToggleCustomer(contact); }}
                        title={contact.isCustomer ? "고객 해제" : "고객으로 등록"}
                      >
                        {contact.isCustomer ? "⭐" : "☆"}
                      </button>
                    </td>
                    <td><span className={styles.contactName}>{contact.name}</span></td>
                    <td><span className={styles.contactPhone}>{contact.phone}</span></td>
                    <td><span className={styles.cellSecondary}>{contact.email || "—"}</span></td>
                    <td><span className={styles.cellSecondary}>{contact.gender === "male" ? "남성" : contact.gender === "female" ? "여성" : "—"}</span></td>
                    <td><span className={styles.cellSecondary}>{contact.joinDate || "—"}</span></td>
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
                              {contact.isCustomer && <span className={styles.inlineBadge} style={{ background: "rgba(102,126,234,0.15)", color: "#818cf8" }}>⭐ 고객</span>}
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
            {contacts.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-title">연락처가 없습니다</div>
                    <div className="empty-state-desc">새 연락처를 추가하거나 CSV 파일을 업로드하세요</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {totalFiltered > PAGE_SIZE && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
            >◀◀</button>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 0}
            >◀</button>
            <span className={styles.pageInfo}>
              <strong>{currentPage + 1}</strong> / {totalPages}
              <span className={styles.pageTotal}> ({totalFiltered.toLocaleString()}명)</span>
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >▶</button>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
            >▶▶</button>
          </div>
        )}
      </div>

      {/* 연락처 추가/수정 모달 */}
      {showAddModal && (
        <ContactAddModal
          activeBookId={activeBookId}
          activeBookName={
            activeBookId
              ? (addressBooks.find((b) => b.id === activeBookId)?.name || "주소록")
              : "전체"
          }
          contactToEdit={editContact}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            await refresh();
          }}
          onAdd={(data) => dataStore.addContact(data)}
          onEdit={(id, data) => dataStore.updateContact(id, data)}
        />
      )}

      {/* CSV 업로드 모달 */}
      {showUploadModal && (
        <CSVUploadModal
          addressBooks={addressBooks}
          activeBookId={activeBookId}
          onClose={() => setShowUploadModal(false)}
          onUploaded={refresh}
          onAddContacts={(list) => dataStore.addContacts(list)}
        />
      )}

      {/* CSV 일괄삭제 — 2단계 강화 경고 다이얼로그 */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>

            {deleteConfirm.step === 1 && (
              <>
                {/* 1단계: 강력 경고 */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 52, marginBottom: 8 }}>⚠️</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f87171", marginBottom: 6 }}>정말 삭제하시겠습니까?</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>이 작업은 되돌릴 수 없습니다</p>
                </div>
                <div style={{ padding: "16px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 10, marginBottom: 16 }}>
                  {deleteConfirm.mode === "all" ? (
                    <p style={{ margin: 0, lineHeight: 1.8, fontSize: 15 }}>
                      <strong>전체 주소록</strong>에서 CSV로 업로드된<br/>
                      <span style={{ fontSize: 28, fontWeight: 800, color: "#f87171" }}>{deleteConfirm.csvCount.toLocaleString()}건</span>이 영구 삭제됩니다.
                    </p>
                  ) : (
                    <p style={{ margin: 0, lineHeight: 1.8, fontSize: 15 }}>
                      <strong>{deleteConfirm.bookName}</strong>에서 CSV로 업로드된<br/>
                      <span style={{ fontSize: 28, fontWeight: 800, color: "#f87171" }}>{deleteConfirm.csvCount.toLocaleString()}건</span>이 영구 삭제됩니다.
                    </p>
                  )}
                </div>
                <ul style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 2, marginBottom: 20, paddingLeft: 20 }}>
                  <li>직접 입력하거나 수정한 연락처는 자동으로 제외됩니다.</li>
                  <li>삭제된 데이터는 복구가 <strong style={{color:"#f87171"}}>불가능</strong>합니다.</li>
                  <li>계속하려면 다음 단계에서 확인 문구를 입력해야 합니다.</li>
                </ul>
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>취소</button>
                  <button
                    className="btn btn-primary"
                    style={{ background: "#ef4444", borderColor: "#ef4444" }}
                    onClick={() => setDeleteConfirm(prev => prev ? { ...prev, step: 2 } : null)}
                    disabled={deleteConfirm.csvCount === 0}
                  >
                    계속 진행 →
                  </button>
                </div>
              </>
            )}

            {deleteConfirm.step === 2 && (
              <>
                {/* 2단계: 텍스트 입력 확인 */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 52, marginBottom: 8 }}>🔐</div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>최종 확인</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    아래 입력란에 <strong style={{ color: "#f87171" }}>"삭제확인"</strong> 을 입력하면 삭제가 실행됩니다.
                  </p>
                </div>
                <div style={{ marginBottom: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  삭제 대상: <strong style={{ color: "#f87171" }}>{deleteConfirm.csvCount.toLocaleString()}건</strong>
                  {deleteConfirm.bookName ? ` (${deleteConfirm.bookName})` : " (전체)"}
                </div>
                <input
                  className="input"
                  style={{ width: "100%", marginBottom: 20, textAlign: "center", fontSize: 16, fontWeight: 700,
                    borderColor: deleteConfirm.inputText === "삭제확인" ? "#22c55e" : "var(--border-primary)" }}
                  placeholder="삭제확인"
                  value={deleteConfirm.inputText}
                  onChange={(e) => setDeleteConfirm(prev => prev ? { ...prev, inputText: e.target.value } : null)}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>취소</button>
                  <button
                    className="btn btn-primary"
                    style={{
                      background: deleteConfirm.inputText === "삭제확인" ? "#ef4444" : "rgba(239,68,68,0.3)",
                      borderColor: "#ef4444",
                      cursor: deleteConfirm.inputText === "삭제확인" ? "pointer" : "not-allowed"
                    }}
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirm.inputText !== "삭제확인"}
                  >
                    {deleteConfirm.csvCount.toLocaleString()}건 영구 삭제
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
