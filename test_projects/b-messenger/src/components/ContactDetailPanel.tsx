// ================================================================
// ContactDetailPanel.tsx — 연락처 상세 사이드 드로어
// 행 클릭 시 우측 슬라이드 패널로 전체 필드 표시 + 수정 버튼
// ================================================================
"use client";

import { Contact } from "@/lib/store";
import styles from "@/styles/ContactDetailPanel.module.css";

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const GENDER_LABEL: Record<string, string> = {
  male: "남성",
  female: "여성",
};

function Row({ label, value }: { label: string; value?: string | null | boolean }) {
  if (value === null || value === undefined || value === "") return null;
  const display =
    typeof value === "boolean" ? (value ? "✅ 동의" : "❌ 미동의") : String(value);
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{display}</span>
    </div>
  );
}

export default function ContactDetailPanel({
  contact,
  onClose,
  onEdit,
  onDelete,
}: ContactDetailPanelProps) {
  return (
    <>
      {/* 백드롭 (모바일용 닫기) */}
      <div
        className={`${styles.backdrop} ${contact ? styles.backdropVisible : ""}`}
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div className={`${styles.panel} ${contact ? styles.panelOpen : ""}`}>
        {contact && (
          <>
            {/* 패널 헤더 */}
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <span className={styles.panelAvatar}>
                  {contact.name.charAt(0)}
                </span>
                <div>
                  <div className={styles.panelName}>{contact.name}</div>
                  <div className={styles.panelPhone}>{contact.phone}</div>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={onClose}>✕</button>
            </div>

            {/* 배지 */}
            <div className={styles.badges}>
              {contact.isCustomer && (
                <span className={styles.badgeCustomer}>⭐ 고객</span>
              )}
              {contact.isKakaoFriend && (
                <span className={styles.badgeKakao}>💬 카카오 친구</span>
              )}
              {contact.marketingAgree && (
                <span className={styles.badgeMarketing}>📣 마케팅 동의</span>
              )}
            </div>

            {/* 상세 필드 */}
            <div className={styles.fields}>
              <div className={styles.fieldSection}>기본 정보</div>
              <Row label="이름" value={contact.name} />
              <Row label="전화번호" value={contact.phone} />
              <Row label="이메일" value={contact.email} />
              <Row label="성별" value={contact.gender ? GENDER_LABEL[contact.gender] ?? contact.gender : null} />
              <Row label="생년월일" value={contact.birthdate} />
              <Row label="가입일" value={contact.joinDate} />

              {(contact.address || contact.postalCode) && (
                <div className={styles.fieldSection}>주소</div>
              )}
              <Row label="우편번호" value={contact.postalCode} />
              <Row label="주소" value={contact.address} />

              {(contact.job || (contact.interests && contact.interests.length > 0)) && (
                <div className={styles.fieldSection}>분류</div>
              )}
              <Row label="구분" value={contact.job} />
              {contact.interests && contact.interests.length > 0 && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>관심사</span>
                  <div className={styles.tagList}>
                    {contact.interests.map((t) => (
                      <span key={t} className={styles.tag}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <Row label="마케팅 수신" value={contact.marketingAgree} />

              {contact.memo && (
                <div className={styles.fieldSection}>메모</div>
              )}
              <Row label="메모" value={contact.memo} />

              <div className={styles.fieldSection}>기타</div>
              <Row
                label="주소록"
                value={contact.addressBookId ? "배정됨" : "전체"}
              />
              <div className={styles.field}>
                <span className={styles.fieldLabel}>등록일</span>
                <span className={styles.fieldValue}>
                  {contact.createdAt
                    ? new Date(contact.createdAt).toLocaleDateString("ko-KR")
                    : "—"}
                </span>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className={styles.panelFooter}>
              <button className={styles.deleteBtn} onClick={onDelete}>
                🗑️ 삭제
              </button>
              <button className={styles.editBtn} onClick={onEdit}>
                ✏️ 수정
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
