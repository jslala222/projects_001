// ================================================================
// Sidebar.tsx — 좌측 네비게이션 사이드바
// 각 메뉴를 클릭하면 해당 페이지로 이동합니다
// ================================================================
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import styles from "@/styles/Sidebar.module.css";

// 네비게이션 메뉴 목록
const mainMenus = [
  { href: "/", icon: "📊", label: "대시보드" },
  { href: "/contacts", icon: "📇", label: "주소록" },
  { href: "/messages", icon: "✉️", label: "메시지 작성" },
  { href: "/campaigns", icon: "📋", label: "발송 이력" },
];

const subMenus = [
  { href: "/templates", icon: "📝", label: "템플릿 관리" },
  { href: "/pricing", icon: "💎", label: "요금제" },
  { href: "/settings", icon: "⚙️", label: "설정" },
];

// 관리자 전용 메뉴
const adminMenus = [
  { href: "/admin", icon: "🛡️", label: "회원 관리" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <aside className={styles.sidebar}>
        {/* 로고 영역 */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>📱</div>
          <div>
            <div className={styles.logoText}>B-Messenger</div>
            <div className={styles.logoVersion}>v1.0 Beta</div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className={styles.nav}>
          {/* 메인 메뉴 */}
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>메인</span>
          </div>
          {mainMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className={`${styles.navLink} ${
                pathname === menu.href ? styles.navLinkActive : ""
              }`}
            >
              <span className={styles.navIcon}>{menu.icon}</span>
              {menu.label}
            </Link>
          ))}

          {/* 서브 메뉴 */}
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>관리</span>
          </div>
          {subMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className={`${styles.navLink} ${
                pathname === menu.href ? styles.navLinkActive : ""
              }`}
            >
              <span className={styles.navIcon}>{menu.icon}</span>
              {menu.label}
            </Link>
          ))}

          {/* 관리자 전용 메뉴 */}
          {isAdmin && (
            <>
              <div className={styles.navSection}>
                <span className={styles.navSectionLabel}>관리자</span>
              </div>
              {adminMenus.map((menu) => (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className={`${styles.navLink} ${
                    pathname === menu.href ? styles.navLinkActive : ""
                  }`}
                >
                  <span className={styles.navIcon}>{menu.icon}</span>
                  {menu.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* 유저 정보 + 로그아웃 */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>👤</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.userName}>
                {user?.user_metadata?.name || user?.email?.split("@")[0] || "사용자"}
              </div>
              <div className={styles.userRole} title={user?.email || ""}>
                {user?.email ? (user.email.length > 20 ? user.email.substring(0, 20) + "…" : user.email) : ""}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(248,113,113,0.2)",
              background: "rgba(248,113,113,0.08)",
              color: "#f87171",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 200ms",
            }}
          >
            🚪 로그아웃
          </button>
        </div>
      </aside>
    </>
  );
}

