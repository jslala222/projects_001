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
  const MAX_BOOKS = 5;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ bookId: string; x: number; y: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" } | null>(null);
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
    if (!isEnterprise) {
      showToast("Enterprise 요금제에서만 주소록을 추가할 수 있습니다.", "error");
      return;
    }
    if (books.length >= MAX_BOOKS) {
      showToast(`주소록은 최대 ${MAX_BOOKS}개까지만 추가할 수 있습니다.`, "error");
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
    if (!isEnterprise) return;
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
    if (!isEnterprise) return;
    e.preventDefault();
    setContextMenu({ bookId, x: e.clientX, y: e.clientY });
  };

  // 주소록 삭제
  const handleDelete = async (bookId: string) => {
    setContextMenu(null);
    if (!confirm("주소록을 삭제하면 소속 연락처는 '전체'로 이동됩니다. 삭제할까요?")) return;
    const res = await dataStore.deleteAddressBook(bookId);
    if (!res.success) {
      showToast(res.error ?? "삭제 실패", "error");
    } else {
      showToast("주소록이 삭제되었습니다.", "success");
      onBooksChange();
      if (activeBookId === bookId) onTabChange(null);
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
            title={isEnterprise ? "더블클릭: 이름 변경 | 우클릭: 삭제" : ""}
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

        {/* Enterprise: + 추가 버튼 */}
        {isEnterprise && (
          <button
            className={`${styles.addBtn} ${books.length >= MAX_BOOKS ? styles.addBtnDisabled : ""}`}
            onClick={handleAdd}
            disabled={addLoading}
            title={books.length >= MAX_BOOKS ? `최대 ${MAX_BOOKS}개까지만 추가 가능합니다` : "주소록 추가"}
          >
            {addLoading ? "…" : "+"}
          </button>
        )}

        {/* Free/Pro: 잠금 배지 */}
        {!isEnterprise && (
          <div className={styles.lockBadge} title="Enterprise 요금제에서 주소록을 최대 5개까지 추가할 수 있습니다.">
            🔒 다중 주소록 <span>Enterprise</span>
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
            onClick={() => handleDelete(contextMenu.bookId)}
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
    </div>
  );
}
