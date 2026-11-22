import { describe, expect, test } from "vitest";
import {
  OPENING_INSTRUCTION,
  buildFortunePrompt,
  buildFortuneTurnPrompt,
  type FortunePromptInput,
} from "./fortune-prompt";

const empty: FortunePromptInput = {
  fortuneContext: null,
  ragContext: null,
  tarotContext: null,
  history: [],
};

describe("buildFortunePrompt", () => {
  test("会話が空なら出迎え指示だけを出す", () => {
    expect(buildFortunePrompt(empty)).toBe(OPENING_INSTRUCTION);
  });

  test("占術・タロット・RAG を先頭に積む", () => {
    const prompt = buildFortunePrompt({
      ...empty,
      fortuneContext: "【占術結果】日干=甲",
      tarotContext: "【タロット鑑定】1枚目: 正位置「愚者」",
      ragContext: "=== 参考: 過去の成功鑑定パターン ===",
    });
    const order = [
      prompt.indexOf("【占術結果】"),
      prompt.indexOf("【タロット鑑定】"),
      prompt.indexOf("参考: 過去の成功鑑定パターン"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("会話を話者ラベル付きの逐語に変換する", () => {
    const prompt = buildFortunePrompt({
      ...empty,
      history: [
        { role: "assistant", content: "ようこそ。生年月日を教えてください。" },
        { role: "user", content: "1990年5月3日です" },
      ],
    });
    expect(prompt).toContain("アストレア: ようこそ。生年月日を教えてください。");
    expect(prompt).toContain("相談者: 1990年5月3日です");
    expect(prompt).toContain("=== これまでのやりとり ===");
  });

  test("会話がある時は出迎え指示を出さない", () => {
    const prompt = buildFortunePrompt({
      ...empty,
      history: [{ role: "user", content: "こんにちは" }],
    });
    expect(prompt).not.toContain(OPENING_INSTRUCTION);
  });

  test("話者名を出力させない指示を末尾に付ける", () => {
    const prompt = buildFortunePrompt({
      ...empty,
      history: [{ role: "user", content: "占って" }],
    });
    expect(prompt.trimEnd().endsWith("本文だけを返してください。")).toBe(true);
  });

  test("空のコンテキストは行を作らない", () => {
    const prompt = buildFortunePrompt({
      ...empty,
      history: [{ role: "user", content: "はい" }],
    });
    expect(prompt.startsWith("=== これまでのやりとり ===")).toBe(true);
  });
});

describe("buildFortuneTurnPrompt", () => {
  // 常駐プロセスは会話文脈を自分で保持するので、毎ターン過去全文を送らない。
  // 現行どおり 2900 字を送り直すと turn2 の firstText が 1202ms → 2433ms に劣化した
  // (2026-07-28 実測) ので、差分だけを送る経路を分ける。
  const emptyTurn = {
    fortuneContext: null,
    ragContext: null,
    tarotContext: null,
    message: null,
  };

  test("会話がまだ無いなら出迎え指示だけを出す", () => {
    expect(buildFortuneTurnPrompt(emptyTurn)).toBe(OPENING_INSTRUCTION);
  });

  test("相談者の発話だけを送り、過去のやりとりは積まない", () => {
    const prompt = buildFortuneTurnPrompt({
      ...emptyTurn,
      message: "1990年5月3日です",
    });
    expect(prompt).toContain("1990年5月3日です");
    expect(prompt).not.toContain("=== これまでのやりとり ===");
  });

  test("新しく判明した命式とタロットは載せる", () => {
    const prompt = buildFortuneTurnPrompt({
      fortuneContext: "【占術結果】日干=甲",
      ragContext: "=== 参考: 過去の成功鑑定パターン ===",
      tarotContext: "【タロット鑑定】1枚目: 正位置「愚者」",
      message: "お願いします",
    });
    const order = [
      prompt.indexOf("【占術結果】"),
      prompt.indexOf("【タロット鑑定】"),
      prompt.indexOf("参考: 過去の成功鑑定パターン"),
      prompt.indexOf("お願いします"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("発話が無くタロットだけのターンも成立する", () => {
    const prompt = buildFortuneTurnPrompt({
      ...emptyTurn,
      tarotContext: "【タロット鑑定】1枚目: 正位置「愚者」",
    });
    expect(prompt).toContain("【タロット鑑定】");
    expect(prompt).not.toContain(OPENING_INSTRUCTION);
  });

  test("話者名を出力させない指示を末尾に付ける", () => {
    const prompt = buildFortuneTurnPrompt({ ...emptyTurn, message: "はい" });
    expect(prompt.trimEnd().endsWith("本文だけを返してください。")).toBe(true);
  });
});
