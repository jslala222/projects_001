// ================================================================
// Header.tsx — 상단 헤더 (검색바 + 알림 + 새 메시지 버튼)
// ================================================================
"use client";

import Link from "next/link";
import styles from "@/styles/Header.module.css";

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className={styles.header}>
      {/* 햄버거 버튼 — 태블릿/모바일 전용 */}
      <button className={styles.hamburger} onClick={onMenuClick} aria-label="메뉴 열기">
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
      </button>

      {/* 검색 바 */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="연락처, 캠페인 검색..."
        />
      </div>

      {/* 액션 영역 */}
      <div className={styles.actions}>
        <button className={styles.iconBtn} title="알림">
          🔔
          <span className={styles.notifDot}></span>
        </button>
        <Link href="/messages">
          <button className={styles.newMsgBtn}>
            ✨ 새 메시지
          </button>
        </Link>
      </div>
    </header>
  );
}
