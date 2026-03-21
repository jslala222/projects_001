// ================================================================
// customers/page.tsx — 고객 관리 전용 페이지
// 주소록 중 '고객'으로 분류된 데이터만 필터링하여 보여줍니다.
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dataStore, Contact, Group } from "@/lib/store";
import { useAuth } from "@/components/AuthContext";
import ContactAddModal from "@/components/ContactAddModal";
import ContactDetailPanel from "@/components/ContactDetailPanel";
import styles from "@/styles/contacts.module.css";

export default function CustomersPage() {
  const { plan, isAdmin } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortKey, setSortKey] = useState<"name_asc" | "name_desc" | "join_date_desc" | "join_date_asc" | "created_desc" | "created_asc">("name_asc");
  const PAGE_SIZE = 20;

  const isFree = plan === "free" && !isAdmin;

  // 그룹 관리 상태
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#667eea");

  useEffect(() => {
    if (!isFree) {
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFree]);

  async function refresh() {
    // onlyCustomers = true 파라미터로 고객만 조회
    const [c, g] = await Promise.all([
      dataStore.getContacts(true), 
      dataStore.getGroups()
    ]);
    setContacts(c);
    setGroups(g);
  }

  // 필터링 (검색 + 그룹) + 정렬
  const filtered = contacts.filter((c) => {
    const matchSearch = c.name.includes(search) || c.phone.includes(search);
    const matchGroup = filterGroup === "all" || c.groupIds.includes(filterGroup);
    return matchSearch && matchGroup;
  }).sort((a, b) => {
    if (sortKey === "name_asc") return a.name.localeCompare(b.name, "ko");
    if (sortKey === "name_desc") return b.name.localeCompare(a.name, "ko");
    if (sortKey === "join_date_desc") return (b.joinDate || "").localeCompare(a.joinDate || "");
    if (sortKey === "join_date_asc") return (a.joinDate || "").localeCompare(b.joinDate || "");
    if (sortKey === "created_desc") return b.createdAt.localeCompare(a.createdAt);
    if (sortKey === "created_asc") return a.createdAt.localeCompare(b.createdAt);
    return 0;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pagedContacts = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function openEditModal(contact: Contact) {
    setDetailContact(null);
    setEditContact(contact);
    setShowEditModal(true);
  }

  function openDetailPanel(contact: Contact) {
    setDetailContact(contact);
  }

  async function handleToggleCustomer(contact: Contact) {
    if (confirm(`${contact.name}님을 일반 주소록으로 이동하시겠습니까? (고객 해제)`)) {
      const success = await dataStore.toggleCustomerStatus(contact.id, false);
      if (success) {
        refresh();
      }
    }
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    await dataStore.addGroup(newGroupName.trim(), newGroupColor);
    setNewGroupName("");
    refresh();
  }

  async function handleDeleteGroup(id: string) {
    if (confirm("그룹을 삭제하면 해당 그룹에 속했던 연락처의 분류 정보만 초기화됩니다. 계속하시겠습니까?")) {
      await dataStore.deleteGroup(id);
      refresh();
    }
  }

  function getGroupColor(groupId: string): string {
    return groups.find(g => g.id === groupId)?.color || "#667eea";
  }

  function getGroupName(groupId: string): string {
    return groups.find(g => g.id === groupId)?.name || "미지정";
  }

  // 무료 요금제 잠금 화면
  if (isFree) {
    return (
      <div className={styles.contactsPage}>
        <div className="page-header">
          <div>
            <h1 className="page-title">💎 고객 관리</h1>
            <p className="page-subtitle">별표(⭐)로 표시된 중요 고객 명단입니다</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16, textAlign: "center" }}>
          <div style={{ fontSize: 64 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>유료 플랜 전용 기능입니다</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.6 }}>
            고객 관리 및 그룹 관리 기능은 Pro 이상 요금제에서 사용 가능합니다.<br />
            지금 업그레이드하고 모든 기능을 활용하세요!
          </p>
          <button className="btn btn-primary" onClick={() => router.push("/pricing")} style={{ marginTop: 8 }}>
            💎 요금제 업그레이드
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.contactsPage}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">💎 고객 관리</h1>
          <p className="page-subtitle">별표(⭐)로 표시된 중요 고객 명단입니다</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowGroupModal(true)}>
            🏷️ 그룹 관리
          </button>
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="고객 이름 또는 번호 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }}
          />
        </div>
        <select
          className={styles.sortSelect}
          value={sortKey}
          onChange={(e) => { setSortKey(e.target.value as typeof sortKey); setCurrentPage(0); }}
          title="정렬 방식"
        >
          <option value="name_asc">이름 가나다순</option>
          <option value="name_desc">이름 역순</option>
          <option value="join_date_desc">가입일 최신순</option>
          <option value="join_date_asc">가입일 오래된순</option>
          <option value="created_desc">등록일 최신순</option>
          <option value="created_asc">등록일 오래된순</option>
        </select>
        <div className={styles.filterChips}>
          <button
            className={`${styles.chip} ${filterGroup === "all" ? styles.chipActive : ""}`}
            onClick={() => { setFilterGroup("all"); setCurrentPage(0); }}
          >
            전체 고객 ({contacts.length})
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`${styles.chip} ${filterGroup === g.id ? styles.chipActive : ""}`}
              onClick={() => { setFilterGroup(g.id); setCurrentPage(0); }}
              style={filterGroup === g.id ? { background: g.color, borderColor: g.color } : {}}
            >
              {g.name} ({g.contactCount})
            </button>
          ))}
        </div>
      </div>

      {/* 고객 테이블 */}
      <div className={styles.tableContainer}>
        <table className={styles.contactTable}>
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>상태</th>
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
            {pagedContacts.map((contact) => (
              <tr key={contact.id} className={`${styles.rowCustomer} ${styles.rowClickable}`} onClick={() => openDetailPanel(contact)}>
                <td style={{ textAlign: "center" }}>
                  <button 
                    className={styles.starBtn} 
                    onClick={(e) => { e.stopPropagation(); handleToggleCustomer(contact); }}
                    title="고객 해제"
                  >
                    ⭐
                  </button>
                </td>
                <td><span className={styles.contactName}>{contact.name}</span></td>
                <td><span className={styles.contactPhone}>{contact.phone}</span></td>
                <td><span className={styles.cellSecondary}>{contact.email || "—"}</span></td>
                <td><span className={styles.cellSecondary}>{contact.gender === "male" ? "남성" : contact.gender === "female" ? "여성" : "—"}</span></td>
                <td><span className={styles.cellSecondary}>{contact.joinDate || "—"}</span></td>
                <td>
                  <div className={styles.groupTags}>
                    {contact.groupIds.map((gId) => (
                      <span key={gId} className={styles.groupTag} style={{ background: getGroupColor(gId) }}>
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
                  </div>
                </td>
              </tr>
            ))}
            {pagedContacts.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-icon">💎</div>
                    <div className="empty-state-title">등록된 고객이 없습니다</div>
                    <div className="empty-state-desc">주소록에서 별표(☆)를 눌러 고객으로 등록하세요</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {filtered.length > PAGE_SIZE && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>◀◀</button>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>◀</button>
            <span className={styles.pageInfo}>
              <strong>{currentPage + 1}</strong> / {totalPages}
              <span className={styles.pageTotal}> ({filtered.length.toLocaleString()}명)</span>
            </span>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>▶</button>
            <button className={styles.pageBtn} onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>▶▶</button>
          </div>
        )}
      </div>

      {/* 수정 모달 (ContactAddModal 사용) */}
      {showEditModal && editContact && (
        <ContactAddModal
          activeBookId={editContact.addressBookId ?? null}
          activeBookName="고객 관리"
          contactToEdit={editContact}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => { setShowEditModal(false); await refresh(); }}
          onAdd={(data) => dataStore.addContact(data)}
          onEdit={(id, data) => dataStore.updateContact(id, data)}
        />
      )}

      {/* 상세 사이드 패널 */}
      <ContactDetailPanel
        contact={detailContact}
        onClose={() => setDetailContact(null)}
        onEdit={() => {
          if (detailContact) openEditModal(detailContact);
        }}
        onDelete={async () => {
          if (detailContact && confirm("고객을 삭제하시겠습니까?")) {
            await dataStore.deleteContact(detailContact.id);
            setDetailContact(null);
            refresh();
          }
        }}
      />


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
            <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--border-primary)", borderRadius: 12, background: "rgba(0,0,0,0.1)" }}>
              {groups.map(g => (
                <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border-primary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative", width: 18, height: 18, borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", flexShrink: 0 }} title="색상 변경">
                      <input
                        type="color"
                        value={g.color}
                        onChange={async (e) => {
                          const newColor = e.target.value;
                          await dataStore.updateGroup(g.id, newColor);
                          refresh();
                        }}
                        style={{ position: "absolute", top: -10, left: -10, width: 44, height: 44, padding: 0, border: "none", cursor: "pointer" }}
                      />
                    </div>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>({g.contactCount}명)</span>
                  </div>
                  <button
                    onClick={() => handleDeleteGroup(g.id)}
                    style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: "4px 8px", fontSize: 13, fontWeight: 600 }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              {groups.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
                  생성된 그룹이 아직 없습니다.
                </div>
              )}
            </div>

            <div className={styles.modalActions} style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowGroupModal(false)} style={{ width: "100%" }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
