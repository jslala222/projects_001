import type { NextConfig } from "next";

// 한국 시간대(KST) 설정 — 모든 서버 사이드 코드에서 한국 시간 사용
process.env.TZ = "Asia/Seoul";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
