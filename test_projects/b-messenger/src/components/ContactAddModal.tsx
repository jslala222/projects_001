// ================================================================
// ContactAddModal.tsx — 연락처 추가/수정 모달 (2단 레이아웃)
// 실시간 미리보기 | 카카오 주소 검색 | 관심사 태그 | 생년월일 드롭박스
// ================================================================
"use client";

import { useState, useCallback } from "react";
import DaumPostcode, { Address } from "react-daum-postcode";
import { Contact, AddressBook } from "@/lib/store";
import styles from "@/styles/ContactAddModal.module.css";

// ── 상수 ──
const JOB_OPTIONS = [
  "", "직장인", "자영업", "학생", "주부", "프리랜서",
  "IT개발", "의료보건", "교육강사", "금융보험", "부동산",
  "유통판매", "서비스업", "기타",
];

const INTEREST_TAGS = [
  "건강", "여행", "음식", "패션", "뷰티", "운동스포츠",
  "자기계발", "육아", "반려동물", "재테크", "IT테크", "문화예술", "독서", "기타",
];

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

function formatPhone(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
}

interface ContactAddModalProps {
  activeBookId: string | null;
  activeBookName: string;
  addressBooks?: AddressBook[];
  contactToEdit?: Contact | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
  onAdd: (data: Omit<Contact, "id" | "createdAt">) => Promise<Contact | null>;
  onEdit: (id: string, data: Partial<Contact>) => Promise<Contact | null>;
}

export default function ContactAddModal({
  activeBookId,
  activeBookName,
  addressBooks,
  contactToEdit,
  onClose,
  onSaved,
  onAdd,
  onEdit,
}: ContactAddModalProps) {
  const isEdit = !!contactToEdit;

  // ── 초기값 파싱 (수정 모드) ──
  const parseBirthdatePart = (part: 0 | 1 | 2) => {
    const bd = contactToEdit?.birthdate;
    if (!bd) return "";
    const parts = bd.split("-");
    return parts[part] ?? "";
  };

  // ── 폼 상태 ──
  const [name, setName] = useState(contactToEdit?.name ?? "");
  const [phone, setPhone] = useState(contactToEdit?.phone ?? "");
  const [email, setEmail] = useState(contactToEdit?.email ?? "");
  const [gender, setGender] = useState<"male" | "female" | "">(
    (contactToEdit?.gender as "male" | "female") ?? ""
  );
  const [birthYear, setBirthYear] = useState(parseBirthdatePart(0));
  const [birthMonth, setBirthMonth] = useState(parseBirthdatePart(1));
  const [birthDay, setBirthDay] = useState(parseBirthdatePart(2));
  const [job, setJob] = useState(contactToEdit?.job ?? "");
  const [interests, setInterests] = useState<string[]>(contactToEdit?.interests ?? []);
  const [selectedGroups] = useState<string[]>(contactToEdit?.groupIds ?? []);
  const [isKakao, setIsKakao] = useState(contactToEdit?.isKakaoFriend ?? false);
  const [postalCode, setPostalCode] = useState(contactToEdit?.postalCode ?? "");
  const [address, setAddress] = useState(contactToEdit?.address ?? "");
  const [addressDetail, setAddressDetail] = useState("");
  const [memo, setMemo] = useState(contactToEdit?.memo ?? "");
  const [marketingAgree, setMarketingAgree] = useState(contactToEdit?.marketingAgree ?? true);
  const [joinDate, setJoinDate] = useState(contactToEdit?.joinDate ?? "");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(
    contactToEdit?.addressBookId ?? activeBookId
  );
  const [showPostcode, setShowPostcode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── 주소 검색 완료 ──
  const handleAddressComplete = useCallback((data: Address) => {
    let fullAddress = data.address;
    if (data.addressType === "R") {
      const extras: string[] = [];
      if (data.bname) extras.push(data.bname);
      if (data.buildingName) extras.push(data.buildingName);
      if (extras.length) fullAddress += ` (${extras.join(", ")})`;
    }
    setPostalCode(data.zonecode);
    setAddress(fullAddress);
    setAddressDetail("");
    setShowPostcode(false);
  }, []);

  // ── 파생값 ──
  const birthdate = [birthYear, birthMonth, birthDay].filter(Boolean).join("-") || null;
  const fullAddress = addressDetail ? `${address} ${addressDetail}`.trim() : address || null;
  const genderLabel = gender === "male" ? "남성" : gender === "female" ? "여성" : "";
  const birthdateLabel = [birthYear, birthMonth, birthDay].filter(Boolean).join(".");

  // ── 관심사 토글 ──
  const toggleInterest = (tag: string) => {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // ── 저장 ──
  async function handleSave() {
    if (!name.trim()) { setError("이름을 입력해주세요."); return; }
    if (!phone.trim()) { setError("전화번호를 입력해주세요."); return; }
    setSaving(true);
    setError("");

    const payload: Omit<Contact, "id" | "createdAt"> = {
      name: name.trim(),
      phone: phone.trim(),
      memo: memo.trim(),
      groupIds: selectedGroups,
      isKakaoFriend: isKakao,
      isCustomer: contactToEdit?.isCustomer ?? false,
      addressBookId: selectedBookId,
      email: email.trim() || null,
      gender: gender || null,
      birthdate,
      job: job || null,
      interests: interests.length > 0 ? interests : null,
      address: fullAddress,
      postalCode: postalCode || null,
      marketingAgree,
      joinDate: joinDate || null,
    };

    const result = isEdit && contactToEdit
      ? await onEdit(contactToEdit.id, payload)
      : await onAdd(payload);

    setSaving(false);
    if (result) {
      onSaved(result.id);
    } else {
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={styles.header}>
          <h2>{isEdit ? "✏️ 연락처 수정" : "➕ 새 연락처 추가"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 2단 레이아웃 */}
        <div className={styles.body}>
          {/* ── 왼쪽: 폼 ── */}
          <div className={styles.formCol}>
            <div className={styles.formSection}>

              {/* 이름 + 전화번호 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>이름 <span className={styles.required}>*</span></label>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>전화번호 <span className={styles.required}>*</span></label>
                  <input
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              {/* 주소록 선택 */}
              {addressBooks && addressBooks.length > 0 && (
                <div className={styles.formGroupFull}>
                  <label>주소록</label>
                  <select
                    className={styles.select}
                    value={selectedBookId ?? ""}
                    onChange={(e) => setSelectedBookId(e.target.value || null)}
                  >
                    <option value="">선택 안함 (기본)</option>
                    {addressBooks.map((book) => (
                      <option key={book.id} value={book.id}>{book.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 이메일 */}
              <div className={styles.formGroupFull}>
                <label>이메일</label>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                />
              </div>

              {/* 성별 + 생년월일 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>성별</label>
                  <div className={styles.radioGroup}>
                    {(["male", "female", ""] as const).map((v) => (
                      <label key={v} className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="gender"
                          checked={gender === v}
                          onChange={() => setGender(v)}
                        />
                        {v === "male" ? "남성" : v === "female" ? "여성" : "미정"}
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>생년월일</label>
                  <div className={styles.birthdateRow}>
                    <input
                      className={`${styles.input} ${styles.yearInput}`}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="1990"
                      maxLength={4}
                    />
                    <select
                      className={styles.select}
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                    >
                      <option value="">월</option>
                      {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
                    </select>
                    <select
                      className={styles.select}
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    >
                      <option value="">일</option>
                      {DAYS.map((d) => <option key={d} value={d}>{d}일</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* 구분 + 카카오 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>구분 (직업)</label>
                  <select
                    className={styles.select}
                    value={job}
                    onChange={(e) => setJob(e.target.value)}
                  >
                    {JOB_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt || "선택 안함"}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>카카오톡 친구</label>
                  <div className={styles.checkRow} onClick={() => setIsKakao(!isKakao)}>
                    <input type="checkbox" checked={isKakao} readOnly />
                    <span>{isKakao ? "💬 친구" : "비친구"}</span>
                  </div>
                </div>
              </div>

              {/* 관심사 */}
              <div className={styles.formGroupFull}>
                <label>관심사</label>
                <div className={styles.tagGrid}>
                  {INTEREST_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.tagBtn} ${interests.includes(tag) ? styles.tagBtnActive : ""}`}
                      onClick={() => toggleInterest(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* 주소 */}
              <div className={styles.formGroupFull}>
                <label>주소</label>
                <div className={styles.addressRow}>
                  <input
                    className={`${styles.input} ${styles.postalInput}`}
                    value={postalCode}
                    placeholder="우편번호"
                    readOnly
                  />
                  <button
                    type="button"
                    className={styles.addressSearchBtn}
                    onClick={() => setShowPostcode(true)}
                  >
                    🔍 주소 검색
                  </button>
                </div>
                <input
                  className={styles.input}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="기본주소"
                />
                <input
                  className={`${styles.input} ${styles.inputMt}`}
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                  placeholder="상세주소 (동·호수 등)"
                />
              </div>

              {/* 가입일 + 메모 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>가입일</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>메모</label>
                  <textarea
                    className={styles.textarea}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="VIP 고객, 3월 가입 등"
                    rows={2}
                  />
                </div>
              </div>

              {/* 마케팅 동의 */}
              <div className={styles.marketingRow} onClick={() => setMarketingAgree(!marketingAgree)}>
                <input type="checkbox" checked={marketingAgree} readOnly />
                <span>마케팅 수신 동의</span>
                <span className={marketingAgree ? styles.agreeYes : styles.agreeNo}>
                  {marketingAgree ? "✅ 동의" : "⬜ 미동의"}
                </span>
              </div>

            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            {/* 저장/취소 버튼 */}
            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>취소</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : isEdit ? "수정 완료" : "추가하기"}
              </button>
            </div>
          </div>

          {/* ── 오른쪽: 실시간 미리보기 ── */}
          <div className={styles.previewCol}>
            <div className={styles.previewLabel}>미리보기</div>
            <div className={styles.previewCard}>
              <div className={styles.previewAvatar}>
                {name ? name[0] : "?"}
              </div>
              <div className={styles.previewName}>{name || "이름 없음"}</div>
              <div className={styles.previewFields}>
                {phone && (
                  <div className={styles.previewField}>
                    <span className={styles.previewIcon}>📱</span>
                    <span>{phone}</span>
                  </div>
                )}
                {email && (
                  <div className={styles.previewField}>
                    <span className={styles.previewIcon}>📧</span>
                    <span>{email}</span>
                  </div>
                )}
                {(genderLabel || birthdateLabel) && (
                  <div className={styles.previewField}>
                    <span className={styles.previewIcon}>👤</span>
                    <span>{[genderLabel, birthdateLabel].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
                {job && (
                  <div className={styles.previewField}>
                    <span className={styles.previewIcon}>🏢</span>
                    <span>{job}</span>
                  </div>
                )}
                {fullAddress && (
                  <div className={styles.previewField}>
                    <span className={styles.previewIcon}>📍</span>
                    <span className={styles.previewAddress}>{fullAddress}</span>
                  </div>
                )}
                {interests.length > 0 && (
                  <div className={styles.previewField}>
                    <span className={styles.previewIcon}>🏷️</span>
                    <div className={styles.previewTags}>
                      {interests.map((t) => (
                        <span key={t} className={styles.previewTag}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className={styles.previewField}>
                  <span className={styles.previewIcon}>📚</span>
                  <span>{activeBookName}</span>
                </div>
                <div className={styles.previewField}>
                  <span className={styles.previewIcon}>{marketingAgree ? "✅" : "⬜"}</span>
                  <span style={{ color: marketingAgree ? "var(--color-success, #22c55e)" : "var(--text-muted)" }}>
                    마케팅 수신 {marketingAgree ? "동의" : "미동의"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 카카오 주소 검색 팝업 ── */}
        {showPostcode && (
          <div className={styles.postcodeOverlay} onClick={() => setShowPostcode(false)}>
            <div className={styles.postcodeModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.postcodeHeader}>
                <h3>주소 검색</h3>
                <button onClick={() => setShowPostcode(false)}>✕</button>
              </div>
              <DaumPostcode
                onComplete={handleAddressComplete}
                style={{ height: "400px", width: "100%" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
