/**
 * 한국 핸드폰 번호 유효성 검사
 * - 010: 반드시 11자리 (010-XXXX-XXXX)
 * - 011/016/017/018/019: 10 또는 11자리
 */
export function isValidKoreanPhone(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("010")) return d.length === 11;
  return /^01[16789]\d{7,8}$/.test(d);
}

/**
 * 전화번호 포맷팅 (01012345678 -> 010-1234-5678)
 */
export function formatPhone(phone: string): string {
  if (!phone) return "";
  const d = phone.replace(/[^0-9]/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) {
    if (d.startsWith("02")) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 9 && d.startsWith("02")) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return phone;
}

/**
 * 전화번호 타입 체크 (휴대폰, 유선전화 등)
 */
export function checkPhoneType(phone: string): "mobile" | "landline" | "unstable" {
  const d = phone.replace(/[^0-9]/g, "");
  if (d.startsWith("01")) return "mobile";
  if (d.startsWith("02") || d.startsWith("03") || d.startsWith("04") || d.startsWith("05") || d.startsWith("06")) return "landline";
  return "unstable";
}

export const PHONE_TYPE_LABEL = {
  mobile: "휴대폰",
  landline: "유선전화",
  unstable: "미확인",
};

export const PHONE_TYPE_BADGE_CLASS = {
  mobile: "bg-blue-50 text-blue-600 border-blue-100",
  landline: "bg-orange-50 text-orange-600 border-orange-100",
  unstable: "bg-slate-50 text-slate-500 border-slate-100",
};
