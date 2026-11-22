// 公開エンドポイント向けのレート制限と日次予算。
//
// このアプリは認証なしで LLM を叩くため、URL が知られた時点で第三者が
// Anthropic の課金を消費できる。多重に縛る:
//   1. IP あたりの短窓レート制限     … 通常利用者に影響しない範囲で連打を止める
//   2. セッションあたりのメッセージ上限 … 1 会話が無限に伸びるのを止める
//   3. 日次の LLM 呼び出し上限        … 財布の最終防衛線 (分散 IP でも突破されない)
//
// 状態は Turso (本番) / better-sqlite3 (ローカル) に置く。serverless は
// instance が使い回されないので in-memory カウンタでは数えられない。

import { createHash } from "node:crypto";
import { ensureSchema, getAdapter } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  /** この window で残り何回許可されるか */
  remaining: number;
  /** 拒否時、次に試せるまでの秒数 */
  retryAfterSeconds: number;
}

/** IP あたり: 10 分で 20 リクエスト。通常の相談 1 回は十数往復に収まる。 */
export const CHAT_RATE_LIMIT = { limit: 20, windowSeconds: 600 };
/**
 * IP あたりの 1 日の総量。
 *
 * 10 分窓だけでは 1 IP が 1 日に理論上 2880 回投げられ、全体共有の
 * DAILY_LLM_CALL_LIMIT を単独で枯らして全員を巻き添えにできた
 * (2026-08-07 セキュリティ監査)。窓の上限とは別に日の総量にも蓋をする。
 * 相談 1 回が十数往復なので、60 なら 1 日に数回の鑑定は通る。
 */
export const CHAT_DAILY_PER_CLIENT = {
  limit: Number(process.env.CHAT_DAILY_PER_CLIENT ?? 60),
  windowSeconds: 86_400,
};
/** 採点 API は LLM を呼ばないので緩め。 */
export const SCORE_RATE_LIMIT = { limit: 30, windowSeconds: 600 };
/** 1 セッションで受け付ける user メッセージ数の上限。 */
export const MAX_MESSAGES_PER_SESSION = 40;
/** 全体の日次 LLM 呼び出し上限 (UTC 日単位)。 */
export const DAILY_LLM_CALL_LIMIT = Number(
  process.env.DAILY_LLM_CALL_LIMIT ?? 500,
);

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 固定窓カウンタ。upsert 1 文で加算と読み出しを済ませるため、
 * 同時リクエストでも数え落ちが起きない (read してから write すると競合する)。
 */
export async function consumeRateLimit(opts: {
  bucket: string;
  limit: number;
  windowSeconds: number;
  nowSeconds?: number;
}): Promise<RateLimitResult> {
  const { bucket, limit, windowSeconds } = opts;
  const now = opts.nowSeconds ?? nowInSeconds();
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;

  await ensureSchema();
  const db = getAdapter();
  const { rows } = await db.execute(
    `INSERT INTO rate_limits (bucket, hits, window_start)
     VALUES (?, 1, ?)
     ON CONFLICT(bucket) DO UPDATE SET
       hits = CASE WHEN rate_limits.window_start = excluded.window_start
                   THEN rate_limits.hits + 1
                   ELSE 1 END,
       window_start = excluded.window_start
     RETURNING hits`,
    [bucket, windowStart],
  );

  const hits = Number(rows[0]?.hits ?? limit + 1);
  const allowed = hits <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - hits),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, windowStart + windowSeconds - now),
  };
}

/**
 * 全体の日次 LLM 呼び出し予算。IP を分散されてもここで止まる。
 */
export async function consumeDailyLlmBudget(opts?: {
  nowSeconds?: number;
}): Promise<RateLimitResult> {
  return consumeRateLimit({
    bucket: "llm:daily",
    limit: DAILY_LLM_CALL_LIMIT,
    windowSeconds: 86_400,
    nowSeconds: opts?.nowSeconds,
  });
}

/**
 * リクエスト元の識別子。
 *
 * 生 IP は保存しない。rate_limits はアプリ DB に置かれるため、素の IP を
 * 入れると「占い相談の記録」と紐づく個人情報が増える。hash だけ保存する。
 */
export function clientFingerprint(headers: Headers): string {
  const salt = process.env.RATE_LIMIT_SALT ?? "ai-fortune-teller";
  return createHash("sha256")
    .update(`${salt}:${resolveClientIp(headers)}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * リクエスト元 IP を、信頼できる順に解決する。
 *
 * `x-forwarded-for` は**送信者が自由に付けられる**。ローカル専用のうちは
 * 実害が無かったが、cloudflared でトンネル公開すると「毎回違う値を入れて
 * レート制限を無限に回避する」経路になる (2026-07-28 公開判断を受けて対処)。
 *
 * 手前に居るプロキシが自分で付け直すヘッダだけを信頼する。Cloudflare Tunnel は
 * `cf-connecting-ip` を必ず上書きするので、これがあれば詐称できない。
 * 逆に proxy が居ない (= ローカル直アクセス) 場合はどのヘッダも信用できないが、
 * その時は外から届かないので実害が無い。
 */
function resolveClientIp(headers: Headers): string {
  // Cloudflare Tunnel が付与。クライアント側の同名ヘッダは上書きされる
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  // proxy 不在時のフォールバック。詐称可能だが、その状況では外部に露出していない
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** 429 レスポンスを組み立てる。内部の閾値は漏らさない。 */
export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    {
      error:
        "星々の巡りが混み合っています。少し時間を置いてからお試しください。",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
