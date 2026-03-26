"use client";

import { useState, useTransition } from "react";
import { importContactsFromFile } from "@/app/actions/customers";
import { formatPhone, isValidKoreanPhone } from "@/lib/phoneUtils";

type Row = { name: string; phone: string; email?: string };
type Result = {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  total: number;
};

// ── EUC-KR / UTF-8 자동 감지 ─────────────────────────────
async function readFileSmart(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    const euc = new TextDecoder("euc-kr").decode(buf);
    if (/[가-힣]/.test(euc)) return euc;
  } catch {}
  return new TextDecoder("utf-8").decode(buf);
}

// ── Quoted-Printable 디코더 (=EC=B5=9C... 형식 한글 복원) ──────────────────────
function decodeQP(str: string): string {
  let result = "";
  let buf: number[] = [];
  const flush = () => {
    if (buf.length > 0) {
      result += new TextDecoder("utf-8").decode(new Uint8Array(buf));
      buf = [];
    }
  };
  let i = 0;
  while (i < str.length) {
    if (str[i] === "=" && i + 2 < str.length && /^[0-9A-Fa-f]{2}$/.test(str.slice(i + 1, i + 3))) {
      buf.push(parseInt(str.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      flush();
      result += str[i];
      i++;
    }
  }
  flush();
  return result;
}

// ── 전화번호 정규화 ───────────────────────────────────────
const norm = (p: string) => p.replace(/[^0-9]/g, "").replace(/^82/, "0");

// ── vcf / Google CSV / 일반 CSV 파서 ─────────────────────
function parseContacts(fileName: string, text: string): Row[] {
  // 1) vCard
  if (fileName.toLowerCase().endsWith(".vcf") || text.trimStart().startsWith("BEGIN:VCARD")) {
    const preprocessed = text.replace(/=\r?\n/g, "");
    const cards = preprocessed.split(/BEGIN:VCARD/i).filter((c) => c.trim());
    const result: Row[] = [];
    for (const card of cards) {
      const fnMatch = card.match(/^FN[^:]*:(.+)$/im);
      const nMatch = card.match(/^N[;:][^:\r\n]*:([^\r\n]+)/im);
      let name = fnMatch?.[1]?.trim().replace(/\r/g, "") ?? "";
      if (/=[0-9A-Fa-f]{2}/.test(name)) name = decodeQP(name).trim().normalize("NFC");
      if (!name && nMatch) {
        const parts = nMatch[1].replace(/\r/g, "").split(";").map((p) =>
          /=[0-9A-Fa-f]{2}/.test(p) ? decodeQP(p).trim().normalize("NFC") : p.trim()
        );
        name = [parts[1], parts[0]].filter(Boolean).join(" ").trim();
      }
      const telMatch = card.match(/^TEL[^:]*:([^\r\n]+)/im);
      const phone = norm(telMatch?.[1]?.trim() ?? "");
      const emailMatch = card.match(/^EMAIL[^:]*:([^\r\n]+)/im);
      const email = emailMatch?.[1]?.trim().replace(/\r/g, "");
      if (name && isValidKoreanPhone(phone)) result.push({ name, phone, email });
    }
    return result;
  }

  // 2) Google CSV
  if (text.includes("Given Name") || text.includes("Family Name")) {
    const lines = text.split("\n").filter((l) => l.trim());
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const gi = headers.findIndex((h) => h === "given name");
    const fi = headers.findIndex((h) => h === "family name");
    const pi = headers.findIndex((h) => h.includes("phone") && h.includes("value"));
    const ei = headers.findIndex((h) => h.includes("e-mail") && h.includes("value"));
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const name = [fi >= 0 ? cols[fi] : "", gi >= 0 ? cols[gi] : ""].filter(Boolean).join(" ");
      const phone = norm(pi >= 0 ? cols[pi] ?? "" : "");
      const email = ei >= 0 ? cols[ei] : undefined;
      return { name, phone, email };
    }).filter((r) => r.name && r.phone);
  }

  // 3) 일반 CSV
  const lines = text.split("\n").filter((l) => l.trim());
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("name") || header.includes("이름") || header.includes("phone") || header.includes("전화");
  return (hasHeader ? lines.slice(1) : lines).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return { name: cols[0] ?? "", phone: norm(cols[1] ?? ""), email: cols[2] };
  }).filter((r) => r.name && r.phone);
}

interface Props {
  onClose: () => void;
  onSuccess: (insertedCount: number) => void;
}

export default function ContactImportModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  const processFile = async (file: File) => {
    setStatus("⏳ 파일 읽는 중...");
    try {
      const text = await readFileSmart(file);
      const rows = parseContacts(file.name, text);
      if (rows.length === 0) {
        setStatus("❌ 유효한 연락처를 찾지 못했습니다. 파일 형식을 확인해주세요.");
        return;
      }
      setAllRows(rows);
      setStatus("");
      setStep("preview");
    } catch (err) {
      console.error("[Import] 오류:", err);
      setStatus("❌ 파일 읽기 오류가 발생했습니다.");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    startTransition(async () => {
      const res = await importContactsFromFile(allRows);
      if (res.error) {
        setStatus(`❌ 오류: ${res.error}`);
        return;
      }
      setResult({
        insertedCount: res.insertedCount ?? 0,
        updatedCount: res.updatedCount ?? 0,
        skippedCount: res.skippedCount ?? 0,
        total: res.total ?? 0,
      });
      setStep("done");
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">📥 vcf / csv 파일 가져오기</h3>
            <p className="text-green-100 text-xs mt-0.5">
              {step === "upload" && ".vcf (아이폰/안드로이드) · .csv (Google/엑셀) 지원"}
              {step === "preview" && `총 ${allRows.length}명 확인 — 중복은 자동 처리됩니다`}
              {step === "done" && "가져오기 완료!"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>

        <div className="p-6">
          {step === "upload" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                  isDragging
                    ? "border-green-500 bg-green-50 scale-[1.02]"
                    : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
                }`}
              >
                <label className="cursor-pointer block">
                  <div className="text-5xl mb-3">{isDragging ? "📂" : "📁"}</div>
                  <p className="text-base font-semibold text-gray-700 mb-1">
                    파일을 드래그하거나 클릭해서 선택
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    <span className="bg-gray-100 rounded px-1.5 py-0.5 mr-1">.vcf</span>아이폰 / 안드로이드
                    <span className="bg-gray-100 rounded px-1.5 py-0.5 ml-2 mr-1">.csv</span>Google / 엑셀
                  </p>
                  <span className="inline-block bg-green-600 text-white text-sm px-4 py-2 rounded-lg">
                    파일 선택하기
                  </span>
                  <input type="file" accept=".vcf,.csv" className="hidden" onChange={handleFileInput} />
                </label>
              </div>

              {status && (
                <p className={`mt-3 text-sm text-center font-medium py-2 rounded-lg ${
                  status.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                }`}>{status}</p>
              )}

              <div className="mt-4 space-y-2">
                <details className="bg-gray-50 rounded-xl">
                  <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer list-none flex items-center justify-between">
                    <span>🍎 아이폰 내보내기 방법</span><span className="text-gray-400">▼</span>
                  </summary>
                  <ol className="px-4 pb-3 text-xs text-gray-600 space-y-1 list-decimal list-inside">
                    <li>PC에서 <strong>icloud.com</strong> 접속 → 로그인</li>
                    <li>연락처 → 좌하단 <strong>⚙️</strong> → 모두 선택</li>
                    <li>⚙️ → <strong>vCard 내보내기</strong> → .vcf 저장</li>
                    <li>위 버튼으로 .vcf 파일 업로드</li>
                  </ol>
                </details>
                <details className="bg-gray-50 rounded-xl">
                  <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer list-none flex items-center justify-between">
                    <span>🤖 안드로이드 내보내기 방법</span><span className="text-gray-400">▼</span>
                  </summary>
                  <ol className="px-4 pb-3 text-xs text-gray-600 space-y-1 list-decimal list-inside">
                    <li>연락처 앱 → 우측 상단 <strong>≡ 메뉴</strong></li>
                    <li>연락처 관리 → <strong>가져오기/내보내기</strong></li>
                    <li><strong>.vcf 파일로 내보내기</strong> → 저장</li>
                    <li>PC로 파일 전송 후 위에 업로드</li>
                  </ol>
                </details>
                <details className="bg-blue-50 rounded-xl">
                  <summary className="px-4 py-3 text-sm font-medium text-blue-700 cursor-pointer list-none flex items-center justify-between">
                    <span>🔵 Google 연락처 (공통)</span><span className="text-blue-400">▼</span>
                  </summary>
                  <ol className="px-4 pb-3 text-xs text-blue-700 space-y-1 list-decimal list-inside">
                    <li>PC에서 <strong>contacts.google.com</strong> 접속</li>
                    <li>좌측 메뉴 → <strong>내보내기</strong></li>
                    <li>Google CSV 선택 → 내보내기</li>
                    <li>위에 .csv 파일 업로드</li>
                  </ol>
                </details>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-semibold">⚡ 중복 자동 처리 방식 (전화번호 기준)</p>
                <p>🟢 <strong>새 번호</strong> → 고객 추가</p>
                <p>🔵 <strong>기존 번호, 이름/이메일 변경</strong> → 정보 업데이트</p>
                <p>⚪ <strong>기존 번호, 동일 정보</strong> → 건너뜀 (중복 없음)</p>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">
                    📋 미리보기 (상위 5명 / 총 {allRows.length}명)
                  </p>
                  <button
                    onClick={() => { setStep("upload"); setStatus(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    ← 다시 선택
                  </button>
                </div>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">이름</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">전화번호</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">이메일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                          <td className="px-3 py-2 text-gray-600">{formatPhone(r.phone)}</td>
                          <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[120px]">{r.email ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allRows.length > 5 && (
                    <p className="text-center text-xs text-gray-400 py-2 bg-gray-50 border-t">
                      외 {allRows.length - 5}명 더...
                    </p>
                  )}
                </div>
              </div>

              {status && (
                <p className={`mb-3 text-sm text-center font-medium py-2 rounded-lg ${
                  status.startsWith("❌") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                }`}>{status}</p>
              )}

              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                  취소
                </button>
                <button onClick={handleImport} disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {isPending ? "⏳ 처리 중..." : `✅ ${allRows.length}명 가져오기`}
                </button>
              </div>
            </>
          )}

          {step === "done" && result && (
            <>
              <div className="text-center py-4">
                <div className="text-5xl mb-4">🎉</div>
                <p className="text-lg font-bold text-gray-900 mb-1">가져오기 완료!</p>
                <p className="text-sm text-gray-500">총 {result.total}명 처리됨</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.insertedCount}</p>
                  <p className="text-xs text-green-700 mt-1">새로 추가</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.updatedCount}</p>
                  <p className="text-xs text-blue-700 mt-1">정보 업데이트</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-500">{result.skippedCount}</p>
                  <p className="text-xs text-gray-500 mt-1">변경 없음</p>
                </div>
              </div>
              <button
                onClick={() => { onClose(); onSuccess(result.insertedCount); }}
                className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                고객 목록으로 돌아가기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
