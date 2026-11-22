import { afterEach, describe, expect, test } from "vitest";
import { childEnv } from "./claude-cli";

const touched: string[] = [];
function setEnv(key: string, value: string) {
  touched.push(key);
  process.env[key] = value;
}
afterEach(() => {
  for (const k of touched.splice(0)) delete process.env[k];
});

describe("childEnv", () => {
  // Claude Code セッションの中から dev server を起動すると ANTHROPIC_BASE_URL を
  // 継承し、CLI がそちらへ OAuth しに行って認証に失敗する (2026-07-28 実測)。
  test("harness が注入するプロキシ設定は剥がす", () => {
    setEnv("ANTHROPIC_BASE_URL", "https://proxy.example");
    expect(childEnv().ANTHROPIC_BASE_URL).toBeUndefined();
  });

  test("API キー系は剥がす（S1: claude -p 経由のみ）", () => {
    setEnv("ANTHROPIC_API_KEY", "sk-test");
    setEnv("ANTHROPIC_AUTH_TOKEN", "tok-test");
    const env = childEnv();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
  });

  // claude setup-token で発行する長期トークンは、このアプリ自身の認証手段。
  // セッション認証 (/login) は約1週間で切れ、実際に 07-28 → 08-04 で失効した。
  // 無人運用にはトークンが要るので、設定されていれば子プロセスへ渡す。
  test("CLAUDE_CODE_OAUTH_TOKEN は渡す（無人運用の認証手段）", () => {
    setEnv("CLAUDE_CODE_OAUTH_TOKEN", "oauth-test-value");
    expect(childEnv().CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-test-value");
  });

  test("未設定なら生えてこない", () => {
    expect(childEnv().CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
  });

  test("無関係な環境変数は素通しする", () => {
    setEnv("SOME_UNRELATED_VAR", "keep-me");
    expect(childEnv().SOME_UNRELATED_VAR).toBe("keep-me");
  });
});
