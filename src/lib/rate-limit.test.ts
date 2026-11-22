import { beforeEach, describe, expect, test } from "vitest";
import { _resetAdapterForTesting, ensureSchema } from "./db";
import {
  CHAT_DAILY_PER_CLIENT,
  CHAT_RATE_LIMIT,
  DAILY_LLM_CALL_LIMIT,
  clientFingerprint,
  consumeDailyLlmBudget,
  consumeRateLimit,
} from "./rate-limit";

beforeEach(async () => {
  _resetAdapterForTesting(":memory:");
  await ensureSchema();
});

describe("consumeRateLimit", () => {
  const base = { bucket: "chat:tester", limit: 3, windowSeconds: 60 };

  test("上限までは許可し、超えたら拒否する", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await consumeRateLimit({ ...base, nowSeconds: 1000 });
      expect(result.allowed, `${i + 1} 回目`).toBe(true);
    }
    const denied = await consumeRateLimit({ ...base, nowSeconds: 1000 });
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("残り回数を返す", async () => {
    const first = await consumeRateLimit({ ...base, nowSeconds: 1000 });
    expect(first.remaining).toBe(2);
    const second = await consumeRateLimit({ ...base, nowSeconds: 1000 });
    expect(second.remaining).toBe(1);
  });

  test("window が変わればカウントがリセットされる", async () => {
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({ ...base, nowSeconds: 1000 });
    }
    expect((await consumeRateLimit({ ...base, nowSeconds: 1000 })).allowed).toBe(
      false,
    );
    const nextWindow = await consumeRateLimit({ ...base, nowSeconds: 1000 + 60 });
    expect(nextWindow.allowed).toBe(true);
    expect(nextWindow.remaining).toBe(2);
  });

  test("bucket ごとに独立して数える", async () => {
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({ ...base, nowSeconds: 1000 });
    }
    const other = await consumeRateLimit({
      ...base,
      bucket: "chat:someone-else",
      nowSeconds: 1000,
    });
    expect(other.allowed).toBe(true);
  });

  test("retryAfterSeconds は window の残り時間になる", async () => {
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit({ ...base, nowSeconds: 1000 });
    }
    // window は floor(1000/60)*60 = 960 開始。1020 まで。now=1000 なら残り 20 秒
    const denied = await consumeRateLimit({ ...base, nowSeconds: 1000 });
    expect(denied.retryAfterSeconds).toBe(20);
  });
});

describe("1 クライアントあたりの日次上限", () => {
  // 2026-08-07 セキュリティ監査。10 分窓 (20回) だけだと 1 IP が 1 日に
  // 理論上 2880 回投げられ、全体共有の日次予算 500 を単独で枯らせた。
  // 窓あたりの上限とは別に、1 クライアントの 1 日の総量にも蓋をする。
  test("10 分窓を積み上げた理論値より厳しい（実際に効く上限である）", () => {
    const perDayFromWindow =
      (86_400 / CHAT_RATE_LIMIT.windowSeconds) * CHAT_RATE_LIMIT.limit;
    expect(CHAT_DAILY_PER_CLIENT.limit).toBeLessThan(perDayFromWindow);
  });

  test("全体の日次予算を 1 クライアントで使い切れない", () => {
    expect(CHAT_DAILY_PER_CLIENT.limit).toBeLessThan(DAILY_LLM_CALL_LIMIT);
  });

  test("窓は 1 日", () => {
    expect(CHAT_DAILY_PER_CLIENT.windowSeconds).toBe(86_400);
  });

  test("上限まで許可し、超えたら拒否する", async () => {
    const bucket = "chatday:tester";
    const nowSeconds = 1_700_000_000;
    for (let i = 0; i < CHAT_DAILY_PER_CLIENT.limit; i++) {
      const r = await consumeRateLimit({
        bucket,
        ...CHAT_DAILY_PER_CLIENT,
        nowSeconds,
      });
      expect(r.allowed, `${i + 1} 回目`).toBe(true);
    }
    const denied = await consumeRateLimit({
      bucket,
      ...CHAT_DAILY_PER_CLIENT,
      nowSeconds,
    });
    expect(denied.allowed).toBe(false);
  });
});

describe("consumeDailyLlmBudget", () => {
  test("日次上限を超えたら拒否する（財布の最終防衛線）", async () => {
    const nowSeconds = 1_700_000_000;
    for (let i = 0; i < DAILY_LLM_CALL_LIMIT; i++) {
      const result = await consumeDailyLlmBudget({ nowSeconds });
      expect(result.allowed, `${i + 1} 回目`).toBe(true);
    }
    expect((await consumeDailyLlmBudget({ nowSeconds })).allowed).toBe(false);
  });

  test("日が変わればリセットされる", async () => {
    const nowSeconds = 1_700_000_000;
    for (let i = 0; i < DAILY_LLM_CALL_LIMIT; i++) {
      await consumeDailyLlmBudget({ nowSeconds });
    }
    expect((await consumeDailyLlmBudget({ nowSeconds })).allowed).toBe(false);
    const nextDay = await consumeDailyLlmBudget({
      nowSeconds: nowSeconds + 86_400,
    });
    expect(nextDay.allowed).toBe(true);
  });
});

describe("clientFingerprint", () => {
  test("x-forwarded-for の先頭 IP で識別する", () => {
    const a = clientFingerprint(
      new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }),
    );
    const b = clientFingerprint(new Headers({ "x-forwarded-for": "203.0.113.7" }));
    expect(a).toBe(b);
  });

  test("別 IP は別の値になる", () => {
    const a = clientFingerprint(new Headers({ "x-forwarded-for": "203.0.113.7" }));
    const b = clientFingerprint(new Headers({ "x-forwarded-for": "203.0.113.8" }));
    expect(a).not.toBe(b);
  });

  test("生 IP を含まない（DB に個人情報を残さない）", () => {
    const fingerprint = clientFingerprint(
      new Headers({ "x-forwarded-for": "203.0.113.7" }),
    );
    expect(fingerprint).not.toContain("203.0.113.7");
    expect(fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  test("x-real-ip にフォールバックする", () => {
    const viaReal = clientFingerprint(new Headers({ "x-real-ip": "203.0.113.9" }));
    const viaXff = clientFingerprint(
      new Headers({ "x-forwarded-for": "203.0.113.9" }),
    );
    expect(viaReal).toBe(viaXff);
  });

  test("IP 不明でも決定的な値を返す", () => {
    const a = clientFingerprint(new Headers());
    const b = clientFingerprint(new Headers());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("トンネル公開時のクライアント識別", () => {
  // 2026-07-28: cloudflared でトンネル公開する判断 (CEO)。
  // x-forwarded-for は送信者が自由に付けられるため、公開面ではレート制限を
  // 無限に回避できる。Cloudflare が付与する cf-connecting-ip を最優先で信頼する。
  test("cf-connecting-ip を x-forwarded-for より優先する", () => {
    const spoofed = clientFingerprint(
      new Headers({
        "cf-connecting-ip": "203.0.113.10",
        "x-forwarded-for": "1.2.3.4",
      }),
    );
    const honest = clientFingerprint(
      new Headers({ "cf-connecting-ip": "203.0.113.10" }),
    );
    expect(spoofed).toBe(honest);
  });

  test("cf-connecting-ip が同じなら x-forwarded-for を変えても同一扱い", () => {
    const a = clientFingerprint(
      new Headers({ "cf-connecting-ip": "203.0.113.10", "x-forwarded-for": "9.9.9.9" }),
    );
    const b = clientFingerprint(
      new Headers({ "cf-connecting-ip": "203.0.113.10", "x-forwarded-for": "8.8.8.8" }),
    );
    expect(a).toBe(b);
  });

  test("信頼できるヘッダが無い時だけ x-forwarded-for に落ちる", () => {
    const viaXff = clientFingerprint(new Headers({ "x-forwarded-for": "203.0.113.11" }));
    const viaCf = clientFingerprint(new Headers({ "cf-connecting-ip": "203.0.113.11" }));
    expect(viaXff).toBe(viaCf);
  });

  test("cf-connecting-ip も生のまま保存しない", () => {
    const fp = clientFingerprint(new Headers({ "cf-connecting-ip": "203.0.113.12" }));
    expect(fp).not.toContain("203.0.113.12");
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
  });
});
