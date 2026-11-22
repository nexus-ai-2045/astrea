import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// この repo は親 workspace の中に clone される運用なので、親の package-lock.json を
// root と誤認されないよう明示する (誤認すると親の依存解決を拾う)。
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// 公開サイト向けのセキュリティヘッダ。
// このアプリは認証なしで LLM を叩くため、埋め込み (iframe) 経由で第三者サイトから
// API を使われる形を塞ぐのが主目的。X-Frame-Options と frame-ancestors は同義だが、
// 古い UA 向けに両方置く。
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'",
  },
];

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  serverExternalPackages: ["better-sqlite3"],
  // Next.js のバージョンを外に出さない
  poweredByHeader: false,
  // 本番でクライアント source map を出さない (ローカルパスや内部構造の露出防止)
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
