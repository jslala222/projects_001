// ================================================================
// contacts/page.tsx — 주소록 관리 페이지
// 연락처 목록 조회, 추가, 수정, 삭제, CSV 업로드 기능
// ================================================================
"use client";

import { useState, useEffect, useRef } from "react";
import { dataStore, Contact, Group } from "@/lib/store";
import styles from "@/styles/contacts.module.css";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폼 상태
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formMemo, setFormMemo] = useState("");
  const [formGroups, setFormGroups] = useState<string[]>([]);
  const [formKakao, setFormKakao] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const [c, g] = await Promise.all([dataStore.getContacts(), dataStore.getGroups()]);
    setContacts(c);
    setGroups(g);
  }

  // 필터링된 연락처
  const filtered = contacts.filter((c) => {
    const matchSearch = c.name.includes(search) || c.phone.includes(search);
    const matchGroup = filterGroup === "all" || c.groupIds.includes(filterGroup);
    return matchSearch && matchGroup;
  });

  function openAddModal() {
    setEditContact(null);
    setFormName(""); setFormPhone(""); setFormMemo(""); setFormGroups([]); setFormKakao(false);
    setShowAddModal(true);
  }

  function openEditModal(contact: Contact) {
    setEditContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phone);
    setFormMemo(contact.memo);
    setFormGroups(contact.groupIds);
    setFormKakao(contact.isKakaoFriend);
    setShowAddModal(true);
  }

  async function handleSave() {
    if (!formName || !formPhone) return;
    if (editContact) {
      await dataStore.updateContact(editContact.id, {
        name: formName, phone: formPhone, memo: formMemo,
        groupIds: formGroups, isKakaoFriend: formKakao,
      });
    } else {
      await dataStore.addContact({
        name: formName, phone: formPhone, memo: formMemo,
        groupIds: formGroups, isKakaoFriend: formKakao,
      });
    }
    setShowAddModal(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (confirm("정말 삭제하시겠습니까?")) {
      await dataStore.deleteContact(id);
      refresh();
    }
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) return;

      const newContacts = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        return {
          name: cols[0] || "이름없음",
          phone: cols[1] || "",
          memo: cols[2] || "",
          groupIds: [] as string[],
          isKakaoFriend: false,
        };
      }).filter(c => c.phone);

      dataStore.addContacts(newContacts).then(() => {
        setShowUploadModal(false);
        refresh();
      });
    };
    reader.readAsText(file);
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
          <h1 className="page-title">📇 주소록</h1>
          <p className="page-subtitle">연락처를 관리하고 그룹으로 분류하세요</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
            📁 CSV 업로드
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            ➕ 연락처 추가
          </button>
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="이름 또는 전화번호로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterChips}>
          <button
            className={`${styles.chip} ${filterGroup === "all" ? styles.chipActive : ""}`}
            onClick={() => setFilterGroup("all")}
          >
            전체 ({contacts.length})
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`${styles.chip} ${filterGroup === g.id ? styles.chipActive : ""}`}
              onClick={() => setFilterGroup(g.id)}
              style={filterGroup === g.id ? { background: g.color, borderColor: g.color } : {}}
            >
              {g.name} ({g.contactCount})
            </button>
          ))}
        </div>
      </div>

      {/* 연락처 테이블 */}
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <span className={styles.tableCount}>
            <strong>{filtered.length}</strong>명의 연락처
          </span>
        </div>
        <table className={styles.contactTable}>
          <thead>
            <tr>
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
              <tr key={contact.id}>
                <td><span className={styles.contactName}>{contact.name}</span></td>
                <td><span className={styles.contactPhone}>{contact.phone}</span></td>
                <td>
                  <div className={styles.groupTags}>
                    {contact.groupIds.map((gId) => (
                      <span key={gId} className={styles.groupTag} style={{ background: getGroupColor(gId) }}>
                        {getGroupName(gId)}
                      </span>
                    ))}
                    {contact.groupIds.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>미지정</span>}
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
                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDelete(contact.id)} title="삭제">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
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
      </div>

      {/* 연락처 추가/수정 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
              {editContact ? "✏️ 연락처 수정" : "➕ 새 연락처 추가"}
            </h2>
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">이름 *</label>
                <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="홍길동" />
              </div>
              <div className="form-group">
                <label className="form-label">전화번호 *</label>
                <input className="input" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="010-1234-5678" />
              </div>
              <div className={`form-group ${styles.formFull}`}>
                <label className="form-label">메모</label>
                <input className="input" value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="VIP 고객, 3월 가입 등" />
              </div>
              <div className="form-group">
                <label className="form-label">그룹</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      className={`${styles.chip} ${formGroups.includes(g.id) ? styles.chipActive : ""}`}
                      style={formGroups.includes(g.id) ? { background: g.color, borderColor: g.color } : {}}
                      onClick={() => {
                        setFormGroups(formGroups.includes(g.id)
                          ? formGroups.filter(id => id !== g.id)
                          : [...formGroups, g.id]
                        );
                      }}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">카카오톡 친구</label>
                <div className="checkbox-wrapper" onClick={() => setFormKakao(!formKakao)}>
                  <input type="checkbox" checked={formKakao} readOnly />
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{formKakao ? "💬 카카오톡 친구" : "비친구"}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editContact ? "수정 완료" : "추가하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV 업로드 모달 */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📁 CSV 파일 업로드</h2>
            <div className={styles.uploadZone} onClick={() => fileInputRef.current?.click()}>
              <div className={styles.uploadIcon}>📄</div>
              <div className={styles.uploadText}>클릭하여 CSV 파일을 선택하세요</div>
              <div className={styles.uploadHint}>첫 번째 행: 이름, 전화번호, 메모 (헤더)</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleCSVUpload}
            />
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
