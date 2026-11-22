import { describe, expect, test } from "vitest";
import { OPENING_GREETINGS, pickOpeningGreeting } from "./opening";

// 出迎えだけは LLM を呼ばない。
//
// 2026-08-07 のセキュリティ監査で、1 つの IP が自分の許容レート内 (20回/10分) で
// 新しい UUID を投げ続けるだけで、全体共有の日次 LLM 予算 500 を約 4 時間で
// 枯らせることが分かった。メッセージが無い初回リクエストでも CLI プロセスが
// 起動して予算を 1 消費していたため。
//
// 出迎えは「歓迎して生年月日を聞く」だけの定型なので、あらかじめ書いておけば
// モデルを呼ぶ必要が無い。副産物として初回表示が即時になる。
describe("出迎えは定型文から選ぶ", () => {
  test("複数用意されている（毎回同じ文面にしない）", () => {
    expect(OPENING_GREETINGS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(OPENING_GREETINGS).size).toBe(OPENING_GREETINGS.length);
  });

  test("どれも生年月日を聞いている", () => {
    for (const g of OPENING_GREETINGS) {
      expect(g, g).toMatch(/生まれ|生年月日/);
    }
  });

  test("どれもカードや占術結果の話をまだしない（フェーズ1なので）", () => {
    for (const g of OPENING_GREETINGS) {
      expect(g, g).not.toMatch(/タロット|カード|星座|ライフパス/);
    }
  });

  test("見出しや話者名を含まない（本文だけを返す契約）", () => {
    for (const g of OPENING_GREETINGS) {
      expect(g, g).not.toMatch(/^#|アストレア\s*[:：]/);
    }
  });

  test("index を渡すと決定的に選べる", () => {
    expect(pickOpeningGreeting(0)).toBe(OPENING_GREETINGS[0]);
    expect(pickOpeningGreeting(1)).toBe(OPENING_GREETINGS[1]);
  });

  test("範囲外の index でも必ず 1 つ返す", () => {
    expect(OPENING_GREETINGS).toContain(pickOpeningGreeting(999));
    expect(OPENING_GREETINGS).toContain(pickOpeningGreeting(-1));
  });

  test("index を省略しても必ず 1 つ返す", () => {
    for (let i = 0; i < 20; i++) {
      expect(OPENING_GREETINGS).toContain(pickOpeningGreeting());
    }
  });
});
