// ================================================================
// CSVUploadModal.tsx — CSV / 엑셀 업로드 모달
// 헤더 자동 인식 | 미리보기 5행 | 주소록 선택 | 템플릿 다운로드
// ================================================================
"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { dataStore, Contact, AddressBook } from "@/lib/store";
import { usePlan } from "@/hooks/usePlan";
import { isValidKoreanPhone } from "@/lib/phoneUtils";
import styles from "@/styles/CSVUploadModal.module.css";

// ── 헤더 자동 매핑 규칙 ──
const HEADER_MAP: Record<string, keyof ParsedRow> = {
  // 이름
  이름: "name", name: "name", 성명: "name",
  // 전화번호
  전화: "phone", 휴대폰: "phone", phone: "phone", 연락처: "phone",
  "전화번호": "phone", "휴대전화": "phone", "핸드폰": "phone",
  // 이메일
  이메일: "email", email: "email", 메일: "email",
  // 성별
  성별: "gender", 남여: "gender", gender: "gender",
  // 생년월일
  생년월일: "birthdate", birth: "birthdate", 생년: "birthdate", 생일: "birthdate",
  // 주소
  주소: "address", address: "address",
  // 우편번호
  우편번호: "postalCode", postal_code: "postalCode", zonecode: "postalCode", 우펹: "postalCode",
  // 구분/직업
  구분: "job", 직업: "job", job: "job", 직종: "job",
  // 관심사
  관심사: "interests", interest: "interests", interests: "interests",
  // 마케팅
  마케팅: "marketingAgree", marketing: "marketingAgree",
  "마케팅수신동의": "marketingAgree", "수신동의": "marketingAgree",
  // 메모
  메모: "memo", memo: "memo", 비고: "memo",
  // 가입일
  가입일: "joinDate", join_date: "joinDate", joindate: "joinDate", 등록일: "joinDate", 등록날짜: "joinDate",
};

interface ParsedRow {
  name?: string;
  phone?: string;
  email?: string;
  gender?: string;
  birthdate?: string;
  address?: string;
  postalCode?: string;
  job?: string;
  interests?: string;
  marketingAgree?: string;
  joinDate?: string;
  memo?: string;
}

const DISPLAY_LABELS: Record<keyof ParsedRow, string> = {
  name: "이름",
  phone: "전화번호",
  email: "이메일",
  gender: "성별",
  birthdate: "생년월일",
  address: "주소",
  postalCode: "우편번호",
  job: "구분",
  interests: "관심사",
  marketingAgree: "마케팅동의",
  joinDate: "가입일",
  memo: "메모",
};

const REQUIRED_FIELDS: Array<keyof ParsedRow> = ["name", "phone"];

// ── 성별 정규화 ──
function normalizeGender(v: string): string {
  const t = v.trim().toLowerCase();
  if (["남", "m", "male", "남성", "남자"].includes(t)) return "male";
  if (["여", "f", "female", "여성", "여자"].includes(t)) return "female";
  return "";
}

// ── 마케팅 정규화 ──
function normalizeMarketing(v: string): boolean {
  const t = v.trim().toLowerCase();
  if (["거부", "미동의", "no", "n", "false", "0", "x"].includes(t)) return false;
  return true; // 기본 동의
}

// ── 전화번호 정규화 ──
function normalizePhone(v: string): string {
  const n = v.replace(/\D/g, "");
  if (n.length === 11) return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  return v.trim();
}

// ── 인코딩 자동 감지 (EUC-KR 폴백) ──
async function readFileText(file: File): Promise<string> {
  // xlsx는 별도 처리
  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) return "";

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // 깨짐 감지: 한글 범위가 없으면 EUC-KR 재시도
      if (/[\uFFFD\u00C3\u00E3]/.test(text.slice(0, 500))) {
        const r2 = new FileReader();
        r2.onload = (e2) => resolve(e2.target?.result as string);
        r2.readAsText(file, "EUC-KR");
      } else {
        resolve(text);
      }
    };
    reader.readAsText(file, "UTF-8");
  });
}

interface CSVUploadModalProps {
  addressBooks: AddressBook[];
  activeBookId: string | null;
  onClose: () => void;
  onUploaded: () => void;
  onAddContacts: (list: Omit<Contact, "id" | "createdAt">[]) => Promise<Contact[]>;
}

export default function CSVUploadModal({
  addressBooks,
  activeBookId,
  onClose,
  onUploaded,
  onAddContacts,
}: CSVUploadModalProps) {
  const { limits } = usePlan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<Record<string, keyof ParsedRow | "">>({});
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [targetBookId, setTargetBookId] = useState<string | null>(activeBookId);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; skip: number } | null>(null);
  const [error, setError] = useState("");
  const [limitError, setLimitError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // ── 헤더 자동 매핑 ──
  function autoMap(hdrs: string[]): Record<string, keyof ParsedRow | ""> {
    const map: Record<string, keyof ParsedRow | ""> = {};
    for (const h of hdrs) {
      const key = h.trim().toLowerCase().replace(/\s+/g, "");
      map[h] = HEADER_MAP[h.trim()] || HEADER_MAP[key] || "";
    }
    return map;
  }

  // ── 파일 파싱 ──
  const handleFile = useCallback(async (file: File) => {
    setError("");
    setResult(null);
    setFileName(file.name);

    let rows: string[][] = [];

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      // 엑셀 파싱
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
      rows = raw.map(r => r.map(String));
    } else {
      // CSV 파싱 (인코딩 자동감지)
      const text = await readFileText(file);
      rows = text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // quoted CSV 처리
          const result: string[] = [];
          let cur = "";
          let inQuote = false;
          for (const ch of line) {
            if (ch === '"') { inQuote = !inQuote; continue; }
            if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; continue; }
            cur += ch;
          }
          result.push(cur.trim());
          return result;
        });
    }

    if (rows.length < 2) {
      setError("데이터가 없습니다. 헤더 + 1행 이상의 데이터가 필요합니다.");
      return;
    }

    const rawHdrs = rows[0].map(h => h.replace(/^\uFEFF/, "").trim()); // BOM 제거 + 공백 제거
    const dataRows = rows.slice(1).filter(r => r.some(c => c.trim()));

    // 헤더도 없고 데이터도 없는 완전 빈 커럼 제거 (Excel 쟘여 커럼 처리)
    const validColIdx = rawHdrs
      .map((h, i) => ({ h, i }))
      .filter(({ h, i }) => h || dataRows.some(r => r[i]?.trim()))
      .map(({ i }) => i);

    const hdrs = validColIdx.map(i => rawHdrs[i] || `(열1${i + 1})`);
    const filteredDataRows = dataRows.map(r => validColIdx.map(i => r[i] ?? ""));

    setHeaders(hdrs);
    setMappedFields(autoMap(hdrs));
    setAllRows(filteredDataRows);
    setPreviewRows(filteredDataRows.slice(0, 5));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── 업로드 실행 ──
  async function handleUpload() {
    const nameCol = Object.entries(mappedFields).find(([, v]) => v === "name")?.[0];
    const phoneCol = Object.entries(mappedFields).find(([, v]) => v === "phone")?.[0];

    if (!nameCol || !phoneCol) {
      setError("이름과 전화번호 컬럼은 반드시 매핑되어야 합니다.");
      return;
    }

    setUploading(true);
    setError("");

    const colIndex = (col: string) => headers.indexOf(col);

    const contacts: Omit<Contact, "id" | "createdAt">[] = [];
    let skip = 0;

    for (const row of allRows) {
      const name = row[colIndex(nameCol)]?.trim();
      const phone = normalizePhone(row[colIndex(phoneCol)] || "");
      if (!name || !phone) { skip++; continue; }
      if (!isValidKoreanPhone(phone)) { skip++; continue; }

      const get = (field: keyof ParsedRow) => {
        const col = Object.entries(mappedFields).find(([, v]) => v === field)?.[0];
        return col ? row[colIndex(col)]?.trim() || "" : "";
      };

      const interestsRaw = get("interests");
      contacts.push({
        name,
        phone,
        email: get("email") || null,
        gender: get("gender") ? normalizeGender(get("gender")) : null,
        birthdate: get("birthdate") || null,
        address: get("address") || null,
        postalCode: get("postalCode") || null,
        job: get("job") || null,
        interests: interestsRaw ? interestsRaw.split(/[,\/，、]/).map(t => t.trim()).filter(Boolean) : null,
        marketingAgree: get("marketingAgree") ? normalizeMarketing(get("marketingAgree")) : true,
        joinDate: get("joinDate") || null,
        memo: get("memo") || "",
        groupIds: [],
        isKakaoFriend: false,
        isCustomer: false,
        addressBookId: targetBookId,
        source: "csv",  // CSV 업로드 표시 → 수정 시 'manual'로 자동 전환됨
      });
    }

    // ── 플랜별 인원 한도 체크 ──
    if (limits.maxContacts !== Infinity) {
      const currentCount = await dataStore.getContactsCount();
      const remaining = limits.maxContacts - currentCount;
      if (remaining <= 0) {
        setLimitError(`현재 플랜 한도(${limits.maxContacts.toLocaleString()}명)에 이미 도달했습니다.\n업그레이드 후 이용해 주세요.`);
        setUploading(false);
        return;
      }
      if (currentCount + contacts.length > limits.maxContacts) {
        setLimitError(`업로드 ${contacts.length.toLocaleString()}명 중 ${remaining.toLocaleString()}명만 추가 가능합니다.\n\n현재 등록: ${currentCount.toLocaleString()}명\n플랜 한도: ${limits.maxContacts.toLocaleString()}명\n추가 가능: ${remaining.toLocaleString()}명\n\n파일 인원을 줄여서 다시 시도해주세요.`);
        setUploading(false);
        return;
      }
    }

    // 배치 INSERT (100건씩)
    const BATCH_SIZE = 100;
    const total = contacts.length;
    let successCount = 0;
    setProgress({ done: 0, total });

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const added = await onAddContacts(batch);
      successCount += added.length;
      setProgress({ done: Math.min(i + BATCH_SIZE, total), total });
    }

    setUploading(false);
    setProgress(null);
    setResult({ success: successCount, skip });
  }

  // ── 템플릿 다운로드 ──
  function downloadTemplate() {
    const header = "이름,전화번호,이메일,성별,생년월일,주소,우편번호,구분,관심사,마케팅수신동의,가입일,메모";
    const sample = "강민준,010-8756-2046,7bjq1r5n@naver.com,남,1985-11-17,서울시 송파구 올림픽로 72번지 103동 1001호,70277,마케터,사진,동의,2026-07-26,재방문 의사 높음";
    const blob = new Blob(["\uFEFF" + header + "\n" + sample], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "b-messenger_연락처_템플릿.csv";
    a.click();
  }

  const mappedCount = Object.values(mappedFields).filter(Boolean).length;
  const hasRequired = REQUIRED_FIELDS.every(f => Object.values(mappedFields).includes(f));
  const targetBookName = targetBookId
    ? (addressBooks.find(b => b.id === targetBookId)?.name || "주소록")
    : "전체";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* 헤더 */}
        <div className={styles.header}>
          <h2>📁 CSV / 엑셀 업로드</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* 결과 화면 */}
          {result ? (
            <div className={styles.resultBox}>
              <div className={styles.resultIcon}>✅</div>
              <div className={styles.resultTitle}>업로드 완료!</div>
              <div className={styles.resultStats}>
                <span className={styles.resultSuccess}>{result.success}명 추가</span>
                {result.skip > 0 && <span className={styles.resultSkip}>{result.skip}행 건너뜀 (이름/전화번호 없음)</span>}
              </div>
              <div className={styles.resultBook}>→ 배정된 주소록: <strong>{targetBookName}</strong></div>
              <button className={styles.saveBtn} onClick={() => { onUploaded(); onClose(); }}>확인</button>
            </div>
          ) : (
            <>
              {/* 주소록 선택 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>📚 업로드할 주소록 선택</label>
                <div className={styles.bookSelector}>
                  <button
                    className={`${styles.bookBtn} ${targetBookId === null ? styles.bookBtnActive : ""}`}
                    onClick={() => setTargetBookId(null)}
                  >
                    전체
                  </button>
                  {addressBooks.map(b => (
                    <button
                      key={b.id}
                      className={`${styles.bookBtn} ${targetBookId === b.id ? styles.bookBtnActive : ""}`}
                      onClick={() => setTargetBookId(b.id)}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 템플릿 안내 + 다운로드 */}
              <div className={styles.templateGuide}>
                <div className={styles.templateGuideText}>
                  <strong>📋 표준 템플릿을 사용하면 컬럼이 자동으로 인식됩니다.</strong>
                  <span>템플릿을 먼저 다운로드하여 데이터를 입력한 후 업로드하세요.</span>
                </div>
                <button className={styles.templateBtn} onClick={downloadTemplate}>
                  ⬇ 템플릿 다운로드 (.csv)
                </button>
              </div>

              {/* 파일 업로드 영역 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>📄 파일 선택</label>
                <div
                  className={styles.dropZone}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {fileName ? (
                    <div className={styles.fileSelected}>
                      <span className={styles.fileIcon}>📄</span>
                      <span className={styles.fileName}>{fileName}</span>
                      <span className={styles.fileInfo}>{allRows.length}행 감지</span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.dropIcon}>📂</div>
                      <div className={styles.dropText}>클릭하거나 파일을 드래그하세요</div>
                      <div className={styles.dropHint}>.csv (UTF-8/EUC-KR 자동감지) · .xlsx · .xls 지원</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>

              {/* 컬럼 매핑 */}
              {headers.length > 0 && (
                <div className={styles.section}>
                  <label className={styles.sectionLabel}>
                    🔗 컬럼 매핑
                    <span className={styles.mappedBadge}>{mappedCount}/{headers.length} 인식됨</span>
                    {!hasRequired && <span className={styles.warnBadge}>⚠ 이름·전화번호 필수</span>}
                  </label>
                  <div className={styles.mappingGrid}>
                    {headers.map((h, idx) => (
                      <div key={idx} className={styles.mappingRow}>
                        <span className={styles.origHeader}>{h}</span>
                        <span className={styles.arrow}>→</span>
                        <select
                          className={`${styles.mappingSelect} ${mappedFields[h] ? styles.mappingSelectMapped : ""}`}
                          value={mappedFields[h] || ""}
                          onChange={(e) => setMappedFields(prev => ({
                            ...prev,
                            [h]: e.target.value as keyof ParsedRow | "",
                          }))}
                        >
                          <option value="">— 무시 —</option>
                          {(Object.keys(DISPLAY_LABELS) as Array<keyof ParsedRow>).map(f => (
                            <option key={f} value={f}>{DISPLAY_LABELS[f]}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미리보기 */}
              {previewRows.length > 0 && (
                <div className={styles.section}>
                  <label className={styles.sectionLabel}>👁 미리보기 (최대 5행)</label>
                  <div className={styles.previewWrapper}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          {headers.map((h, idx) => (
                            <th key={idx} className={mappedFields[h] ? styles.previewThMapped : styles.previewTh}>
                              {h}
                              {mappedFields[h] && <span className={styles.previewThBadge}>{DISPLAY_LABELS[mappedFields[h] as keyof ParsedRow]}</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} className={styles.previewTd}>{cell || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && <div className={styles.errorMsg}>{error}</div>}

              {/* 진행률 */}
              {uploading && progress && (
                <div className={styles.progressSection}>
                  <div className={styles.progressInfo}>
                    <span>업로드 중...</span>
                    <span className={styles.progressCount}>{progress.done} / {progress.total}건</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.progressPct}>
                    {Math.round((progress.done / progress.total) * 100)}%
                  </div>
                </div>
              )}

              {/* 하단 버튼 */}
              <div className={styles.footer}>
                <button className={styles.cancelBtn} onClick={onClose} disabled={uploading}>취소</button>
                {headers.length > 0 && !uploading && (
                  <button
                    className={styles.saveBtn}
                    onClick={handleUpload}
                    disabled={!hasRequired}
                  >
                    ✅ {targetBookName}에 {allRows.length}명 추가
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 플랜 한도 초과 알림 모달 */}
      {limitError && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
        }}>
          <div style={{
            background: "#1e1e2e",
            border: "1px solid #f87171",
            borderRadius: 16,
            padding: "32px 28px",
            maxWidth: 420,
            width: "90%",
            textAlign: "center",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f87171", marginBottom: 16 }}>
              업로드 제한 초과
            </h3>
            <p style={{
              fontSize: 14, color: "#e2e8f0", lineHeight: 1.8,
              whiteSpace: "pre-line", marginBottom: 24,
            }}>
              {limitError}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setLimitError("")}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  background: "#374151", color: "#fff",
                  border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
                }}
              >
                닫기
              </button>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
