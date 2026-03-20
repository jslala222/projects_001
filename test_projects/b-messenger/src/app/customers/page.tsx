// ================================================================
// customers/page.tsx — 고객 관리 전용 페이지
// 주소록 중 '고객'으로 분류된 데이터만 필터링하여 보여줍니다.
// ================================================================
"use client";

import { useState, useEffect } from "react";
import { dataStore, Contact, Group } from "@/lib/store";
import styles from "@/styles/contacts.module.css";

export default function CustomersPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [editContact, setEditContact] = useState<Contact | null>(null);

  // 폼 상태 (수정용)
  const [showEditModal, setShowEditModal] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formMemo, setFormMemo] = useState("");
  const [formGroups, setFormGroups] = useState<string[]>([]);
  const [formKakao, setFormKakao] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    // onlyCustomers = true 파라미터로 고객만 조회
    const [c, g] = await Promise.all([
      dataStore.getContacts(true), 
      dataStore.getGroups()
    ]);
    setContacts(c);
    setGroups(g);
  }

  // 필터링 (검색 + 그룹)
  const filtered = contacts.filter((c) => {
    const matchSearch = c.name.includes(search) || c.phone.includes(search);
    const matchGroup = filterGroup === "all" || c.groupIds.includes(filterGroup);
    return matchSearch && matchGroup;
  });

  function openEditModal(contact: Contact) {
    setEditContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phone);
    setFormMemo(contact.memo);
    setFormGroups(contact.groupIds);
    setFormKakao(contact.isKakaoFriend);
    setShowEditModal(true);
  }

  async function handleSave() {
    if (!formName || !formPhone || !editContact) return;
    await dataStore.updateContact(editContact.id, {
      name: formName, 
      phone: formPhone, 
      memo: formMemo,
      groupIds: formGroups, 
      isKakaoFriend: formKakao,
    });
    setShowEditModal(false);
    refresh();
  }

  async function handleToggleCustomer(contact: Contact) {
    if (confirm(`${contact.name}님을 일반 주소록으로 이동하시겠습니까? (고객 해제)`)) {
      const success = await dataStore.toggleCustomerStatus(contact.id, false);
      if (success) {
        refresh();
      }
    }
  }

  function getGroupColor(groupId: string): string {
    return groups.find(g => g.id === groupId)?.color || "#667eea";
  }

  function getGroupName(groupId: string): string {
    return groups.find(g => g.id === groupId)?.name || "미지정";
  }

  return (
    <div className={styles.contactsPage}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">💎 고객 관리</h1>
          <p className="page-subtitle">별표(⭐)로 표시된 중요 고객 명단입니다</p>
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="고객 이름 또는 번호 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterChips}>
          <button
            className={`${styles.chip} ${filterGroup === "all" ? styles.chipActive : ""}`}
            onClick={() => setFilterGroup("all")}
          >
            전체 고객 ({contacts.length})
          </button>
          {groups.filter(g => g.contactCount > 0).map((g) => (
            <button
              key={g.id}
              className={`${styles.chip} ${filterGroup === g.id ? styles.chipActive : ""}`}
              onClick={() => setFilterGroup(g.id)}
              style={filterGroup === g.id ? { background: g.color, borderColor: g.color } : {}}
            >
              {g.name}
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
              <th>그룹</th>
              <th>카카오톡</th>
              <th>메모</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((contact) => (
              <tr key={contact.id} className={styles.rowCustomer}>
                <td style={{ textAlign: "center" }}>
                  <button 
                    className={styles.starBtn} 
                    onClick={() => handleToggleCustomer(contact)}
                    title="고객 해제"
                  >
                    ⭐
                  </button>
                </td>
                <td><span className={styles.contactName}>{contact.name}</span></td>
                <td><span className={styles.contactPhone}>{contact.phone}</span></td>
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
                    <button className={styles.actionBtn} onClick={() => openEditModal(contact)} title="수정">✏️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
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
      </div>

      {/* 수정 모달 */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>✏️ 고객 정보 수정</h2>
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">이름 *</label>
                <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">전화번호 *</label>
                <input className="input" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
              <div className={`form-group ${styles.formFull}`}>
                <label className="form-label">메모</label>
                <input className="input" value={formMemo} onChange={(e) => setFormMemo(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave}>수정 완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
