// ================================================================
// AddressBookTabs.tsx — 다중 주소록 탭 컴포넌트
// Enterprise 전용: 최대 5개 주소록 탭 추가/이름변경/삭제
// ================================================================
"use client";

import { useState, useRef, useEffect } from "react";
import { AddressBook, dataStore } from "@/lib/store";
import styles from "@/styles/AddressBookTabs.module.css";

// slot 1~5 고유 색상
const SLOT_COLORS = [
  { main: "#7c3aed", bg: "rgba(124,58,237,0.12)", badge: "rgba(124,58,237,0.18)" }, // 1 보라
  { main: "#2563eb", bg: "rgba(37,99,235,0.12)",  badge: "rgba(37,99,235,0.18)"  }, // 2 파랑
  { main: "#059669", bg: "rgba(5,150,105,0.12)",  badge: "rgba(5,150,105,0.18)"  }, // 3 에메랄드
  { main: "#d97706", bg: "rgba(217,119,6,0.12)",  badge: "rgba(217,119,6,0.18)"  }, // 4 주황
  { main: "#db2777", bg: "rgba(219,39,119,0.12)", badge: "rgba(219,39,119,0.18)" }, // 5 핑크
];

interface Props {
  books: AddressBook[];
  totalCount: number;
  activeBookId: string | null; // null = 전체
  plan: string;
  onTabChange: (bookId: string | null) => void;
  onBooksChange: () => void;
  onDeleteCsvByBook?: (bookId: string) => void;
}

export default function AddressBookTabs({
  books,
  totalCount,
  activeBookId,
  plan,
  onTabChange,
  onBooksChange,
  onDeleteCsvByBook,
}: Props) {
  const isEnterprise = plan === "enterprise";
  const isPro = plan === "pro" || plan === "enterprise";
  const MAX_BOOKS = isEnterprise ? 5 : isPro ? 2 : 0;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ bookId: string; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);
  const [alertModal, setAlertModal] = useState<{ title: string; desc: string; upgrade?: boolean } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ bookId: string; bookName: string; contactCount: number; step: 1 | 2; nameInput: string } | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 토스트 자동 닫기 (3초)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // 편집 인풋 자동 포커스
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // 외부 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToast({ msg, type });
  };

  // + 버튼 클릭
  const handleAdd = async () => {
    if (!isPro) {
      setAlertModal({
        title: "주소록 추가 불가",
        desc: `다중 주소록 기능은 Pro 이상 요금제에서 사용 가능합니다.\n\n현재 플랜: FREE\n\n플랜 업그레이드 후 이용해 주세요.`,
        upgrade: true,
      });
      return;
    }
    if (books.length >= MAX_BOOKS) {
      setAlertModal({
        title: "주소록 한도 도달",
        desc: `현재 플랜(${isEnterprise ? "Enterprise" : "Pro"})에서는 주소록을 최대 ${MAX_BOOKS}개까지 사용할 수 있습니다.\n\n현재 등록: ${books.length}개 / 한도: ${MAX_BOOKS}개${!isEnterprise ? "\n\nEnterprise로 업그레이드 시 최덅5개까지 사용 가능합니다." : ""}`,
        upgrade: !isEnterprise,
      });
      return;
    }
    setAddLoading(true);
    const res = await dataStore.addAddressBook(`주소록 ${books.length + 1}`, plan);
    setAddLoading(false);
    if (!res.success) {
      showToast(res.error ?? "추가 실패", "error");
    } else {
      showToast("주소록이 추가되었습니다.", "success");
      onBooksChange();
      if (res.data) onTabChange(res.data.id);
    }
  };

  // 탭 더블클릭 → 이름 편집
  const handleDoubleClick = (book: AddressBook) => {
    if (!isPro) return;
    setEditingId(book.id);
    setEditingName(book.name);
  };

  // 이름 저장
  const handleRenameConfirm = async (bookId: string) => {
    if (!editingName.trim()) { setEditingId(null); return; }
    const res = await dataStore.renameAddressBook(bookId, editingName);
    setEditingId(null);
    if (!res.success) {
      showToast(res.error ?? "이름 변경 실패", "error");
    } else {
      onBooksChange();
    }
  };

  // 우클릭 컨텍스트 메뉴
  const handleContextMenu = (e: React.MouseEvent, bookId: string) => {
    if (!isPro) return;
    e.preventDefault();
    setContextMenu({ bookId, x: e.clientX, y: e.clientY });
  };

  // 주소록 삭제 — 1단계 먥보 열기
  const handleDeleteRequest = (bookId: string) => {
    setContextMenu(null);
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    setDeleteModal({ bookId, bookName: book.name, contactCount: book.contactCount, step: 1, nameInput: "" });
  };

  // 주소록 삭제 — 2단계 확인 후 실행
  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    const res = await dataStore.deleteAddressBook(deleteModal.bookId);
    setDeleteModal(null);
    if (!res.success) {
      showToast(res.error ?? "삭제 실패", "error");
    } else {
      showToast("주소록이 삭제되었습니다.", "success");
      onBooksChange();
      if (activeBookId === deleteModal.bookId) onTabChange(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* 탭 바 */}
      <div className={styles.tabBar}>
        {/* 전체 탭 (고정, 읽기전용) */}
        <button
          className={`${styles.tab} ${styles.tabAll} ${activeBookId === null ? styles.active : ""}`}
          onClick={() => onTabChange(null)}
        >
          <span className={styles.tabLabel}>전체</span>
          <span className={styles.tabCount}>{totalCount}</span>
        </button>

        {/* 주소록 탭들 */}
        {books.map((book, idx) => {
          const color = SLOT_COLORS[Math.min(idx, SLOT_COLORS.length - 1)];
          const isActive = activeBookId === book.id;
          return (
          <button
            key={book.id}
            className={`${styles.tab} ${styles.tabColored} ${isActive ? styles.activeColored : ""}`}
            style={{
              "--tab-color": color.main,
              "--tab-bg": color.bg,
              "--tab-badge": color.badge,
            } as React.CSSProperties}
            onClick={() => { if (editingId !== book.id) onTabChange(book.id); }}
            onDoubleClick={() => handleDoubleClick(book)}
            onContextMenu={(e) => handleContextMenu(e, book.id)}
            title={isPro ? "더블클릭: 이름 변경 | 우클릭: 삭제" : ""}
          >
            {editingId === book.id ? (
              <input
                ref={inputRef}
                className={styles.editInput}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRenameConfirm(book.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameConfirm(book.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                maxLength={20}
              />
            ) : (
              <>
                <span className={styles.tabLabel}>{book.name}</span>
                <span className={styles.tabCountColored}>{book.contactCount}</span>
              </>
            )}
          </button>
          );
        })}

        {/* Pro 이상: + 추가 버튼 */}
        {isPro && (
          <button
            className={`${styles.addBtn} ${books.length >= MAX_BOOKS ? styles.addBtnDisabled : ""}`}
            onClick={handleAdd}
            disabled={addLoading}
            title={books.length >= MAX_BOOKS ? `최대 ${MAX_BOOKS}개까지만 추가 가능합니다` : "주소록 추가"}
          >
            {addLoading ? "…" : "+"}
          </button>
        )}

        {/* Free: 잠금 배지 */}
        {!isPro && (
          <div className={styles.lockBadge} title="Pro 이상 요금제에서 주소록을 추가할 수 있습니다.">
            🔒 다중 주소록 <span>Pro+</span>
          </div>
        )}
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const book = books.find((b) => b.id === contextMenu.bookId);
              if (book) {
                setEditingId(book.id);
                setEditingName(book.name);
                onTabChange(book.id);
              }
              setContextMenu(null);
            }}
          >
            ✏️ 이름 변경
          </button>
          <button
            className={styles.contextMenuDanger}
            onClick={() => handleDeleteRequest(contextMenu.bookId)}
          >
            🗑️ 주소록 삭제
          </button>
          {onDeleteCsvByBook && (
            <button
              className={styles.contextMenuDanger}
              onClick={() => {
                onDeleteCsvByBook(contextMenu.bookId);
                setContextMenu(null);
              }}
              style={{ borderTop: "1px solid rgba(248,113,113,0.2)", marginTop: 2, paddingTop: 6 }}
            >
              📄 CSV 연락처만 삭제
            </button>
          )}
        </div>
      )}

      {/* 토스트 메시지 */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === "error" ? "⚠️" : "✅"} {toast.msg}
        </div>
      )}

      {/* 주소록 제한 알림 팝업 모달 */}
      {alertModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
        }} onClick={() => setAlertModal(null)}>
          <div style={{
            background: "#1e1e2e",
            border: "1px solid #7c3aed",
            borderRadius: 16,
            padding: "32px 28px",
            maxWidth: 400,
            width: "90%",
            textAlign: "center",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#a78bfa", marginBottom: 16 }}>
              {alertModal.title}
            </h3>
            <p style={{
              fontSize: 14, color: "#e2e8f0", lineHeight: 1.8,
              whiteSpace: "pre-line", marginBottom: 24,
            }}>
              {alertModal.desc}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setAlertModal(null)}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  background: "#374151", color: "#fff",
                  border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                }}
              >
                닫기
              </button>
              {alertModal.upgrade && (
                <a
                  href="/pricing"
                  style={{
                    padding: "9px 22px", borderRadius: 8,
                    background: "#7c3aed", color: "#fff",
                    border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                    textDecoration: "none", display: "inline-block",
                  }}
                >
                  플랜 업그레이드 →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 주소록 삭제 2단계 확인 모달 */}
      {deleteModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)",
        }}>
          <div style={{
            background: "#1e1e2e",
            border: "1px solid #ef4444",
            borderRadius: 16,
            padding: "32px 28px",
            maxWidth: 420,
            width: "90%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          }} onClick={(e) => e.stopPropagation()}>
            {deleteModal.step === 1 ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 12, textAlign: "center" }}>🗑️</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#ef4444", marginBottom: 16, textAlign: "center" }}>
                  주소록 삭제
                </h3>
                <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, marginBottom: 8 }}>
                  주소록 <strong style={{ color: "#fde68a" }}>"{deleteModal.bookName}"</strong>을 삭제합니다.
                </p>
                <p style={{ fontSize: 13, color: "#f87171", lineHeight: 1.7, marginBottom: 24 }}>
                  ⚠️ 포함된 연락처 <strong>{deleteModal.contactCount}명</strong>은 '전체' 목록으로 이동되며,
                  이 작업은 되돌릴 수 없습니다.
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    onClick={() => setDeleteModal(null)}
                    style={{
                      padding: "9px 22px", borderRadius: 8,
                      background: "#374151", color: "#fff",
                      border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={() => setDeleteModal({ ...deleteModal, step: 2 })}
                    style={{
                      padding: "9px 22px", borderRadius: 8,
                      background: "#7f1d1d", color: "#fca5a5",
                      border: "1px solid #ef4444", cursor: "pointer", fontWeight: 600, fontSize: 14,
                    }}
                  >
                    다음 →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 12, textAlign: "center" }}>✍️</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#ef4444", marginBottom: 16, textAlign: "center" }}>
                  삭제 확인
                </h3>
                <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, marginBottom: 12 }}>
                  계속하려면 주소록 이름을 정확히 입력해 주세요:
                </p>
                <p style={{ fontSize: 13, color: "#fde68a", marginBottom: 10, fontWeight: 600 }}>
                  {deleteModal.bookName}
                </p>
                <input
                  type="text"
                  value={deleteModal.nameInput}
                  onChange={(e) => setDeleteModal({ ...deleteModal, nameInput: e.target.value })}
                  placeholder={deleteModal.bookName}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: "#0f172a", border: "1px solid #ef4444",
                    borderRadius: 8, color: "#fff", fontSize: 14, marginBottom: 20,
                    boxSizing: "border-box",
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deleteModal.nameInput === deleteModal.bookName) handleDeleteConfirm();
                  }}
                />
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button
                    onClick={() => setDeleteModal(null)}
                    style={{
                      padding: "9px 22px", borderRadius: 8,
                      background: "#374151", color: "#fff",
                      border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteModal.nameInput !== deleteModal.bookName}
                    style={{
                      padding: "9px 22px", borderRadius: 8,
                      background: deleteModal.nameInput === deleteModal.bookName ? "#dc2626" : "#374151",
                      color: deleteModal.nameInput === deleteModal.bookName ? "#fff" : "#6b7280",
                      border: "none", cursor: deleteModal.nameInput === deleteModal.bookName ? "pointer" : "not-allowed",
                      fontWeight: 700, fontSize: 14, transition: "all 0.2s",
                    }}
                  >
                    영구 삭제
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
