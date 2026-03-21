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
  { href: "/customers", icon: "💎", label: "고객 관리", premiumOnly: true },
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
  { href: "/admin/subscriptions", icon: "💳", label: "구독 관리" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, plan, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  // 메뉴 노출 여부 및 잠금 여부 판단 함수
  const renderMenuItem = (menu: { href: string; icon: string; label: string; premiumOnly?: boolean }) => {
    // 🔒 테스트를 위해 isAdmin 체크를 잠시 빼거나, 명시적으로 plan 조건을 더 엄격하게 체크
    const isLocked = menu.premiumOnly && plan !== "enterprise" && isAdmin !== true;
    
    return (
      <Link
        key={menu.href}
        href={isLocked ? "#" : menu.href}
        onClick={(e) => {
          if (isLocked) {
            e.preventDefault();
            alert("💎 Premium 플랜 전용 메뉴입니다. 요금제 페이지에서 업그레이드 해주세요!");
            router.push("/pricing");
          }
        }}
        className={`${styles.navLink} ${
          pathname === menu.href ? styles.navLinkActive : ""
        } ${isLocked ? styles.navLinkLocked : ""}`}
      >
        <span className={styles.navIcon}>
          {isLocked ? (
            <span style={{ color: "#fbbf24" }}>🔒</span>
          ) : (
            menu.icon
          )}
        </span>
        {menu.label}
        {isLocked && <span style={{ fontSize: 10, marginLeft: "auto", opacity: 0.6 }}>UPGRADE</span>}
      </Link>
    );
  };

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
          {mainMenus.map((menu) => renderMenuItem(menu))}

          {/* 서브 메뉴 */}
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>관리</span>
          </div>
          {subMenus.map((menu) => renderMenuItem(menu))}

          {/* 관리자 전용 메뉴 */}
          {isAdmin && (
            <>
              <div className={styles.navSection}>
                <span className={styles.navSectionLabel}>관리자</span>
              </div>
              {adminMenus.map((menu) => renderMenuItem(menu))}
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

