// ================================================================
// utils.ts — 한국 시간(KST) 유틸리티 함수 모음
// CLAUDE.md 규칙: 모든 시간/날짜는 KST로 처리
// ================================================================

/**
 * 현재 한국 시간을 Date 객체로 반환
 */
export function getNowKST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}

/**
 * Date 객체를 한국 시간으로 변환
 */
export function toKSTDate(date: Date): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
}

/**
 * 한국 시간을 지정된 포맷으로 반환
 * @param date - 변환할 Date 객체 (기본값: 현재 시간)
 * @param format - 포맷 문자열 (기본값: 'YYYY-MM-DD HH:mm:ss')
 *   지원 토큰: YYYY, MM, DD, HH, mm, ss
 */
export function formatKSTDate(
  date: Date = new Date(),
  format: string = "YYYY-MM-DD HH:mm:ss"
): string {
  const kst = toKSTDate(date);
  const year = kst.getFullYear().toString();
  const month = (kst.getMonth() + 1).toString().padStart(2, "0");
  const day = kst.getDate().toString().padStart(2, "0");
  const hours = kst.getHours().toString().padStart(2, "0");
  const minutes = kst.getMinutes().toString().padStart(2, "0");
  const seconds = kst.getSeconds().toString().padStart(2, "0");

  return format
    .replace("YYYY", year)
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hours)
    .replace("mm", minutes)
    .replace("ss", seconds);
}

/**
 * 한국 시간의 날짜만 반환 (YYYY-MM-DD)
 */
export function toKSTDateString(date: Date = new Date()): string {
  return formatKSTDate(date, "YYYY-MM-DD");
}

/**
 * 한국식 로케일 포맷으로 반환
 * 예: '2026. 3. 20. 오후 1:45:30'
 */
export function formatKSTLocale(date: Date = new Date()): string {
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
