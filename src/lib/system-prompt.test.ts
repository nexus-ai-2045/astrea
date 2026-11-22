// システムプロンプト設計テスト — 「鏡としての占い師」v2
// TDD: RED → GREEN → REFACTOR

import { describe, it, expect } from "vitest";
import { CHAT_SYSTEM_PROMPT, ONESHOT_SYSTEM_PROMPT } from "./system-prompt";

describe("システムプロンプト: 禁止要素の排除", () => {
  const allPrompts = [CHAT_SYSTEM_PROMPT, ONESHOT_SYSTEM_PROMPT];

  it("キャリアコンサル偽装が含まれないこと", () => {
    for (const prompt of allPrompts) {
      expect(prompt).not.toContain("キャリアコンサル");
      expect(prompt).not.toContain("プロファイリング");
      expect(prompt).not.toContain("表向きは占い師");
      expect(prompt).not.toContain("実態は");
    }
  });

  it("バーナム効果の意図的活用が含まれないこと", () => {
    for (const prompt of allPrompts) {
      expect(prompt).not.toContain("バーナム効果");
    }
  });

  // 2026-08-05: 「誰にでも当てはまる」の単純禁止をやめ、文脈判定に変えた。
  // リサーチ (research/tarot-dialogue-design) を受けて**禁止条項として**この語を
  // 使うようになったため、部分文字列の有無だけでは「教えている」のか
  // 「禁じている」のか区別できない。意図は変えず、判定だけ精密にする。
  it("誰にでも当てはまる表現は、使えではなく避けよと書かれていること", () => {
    for (const prompt of allPrompts) {
      const idx = prompt.indexOf("誰にでも当てはま");
      if (idx === -1) continue;
      const nearby = prompt.slice(idx, idx + 120);
      expect(nearby, "禁止文脈で使われていること").toMatch(
        /見せかけない|避ける|使わない|頼らない/,
      );
    }
  });

  it("コールドリーディングテクニック集が含まれないこと", () => {
    for (const prompt of allPrompts) {
      expect(prompt).not.toContain("コールドリーディング");
      expect(prompt).not.toContain("ホットリーディング");
    }
  });

  it("ステレオタイプ推測が含まれないこと", () => {
    for (const prompt of allPrompts) {
      expect(prompt).not.toContain("年代別の傾向");
      expect(prompt).not.toContain("職業別の核心");
      expect(prompt).not.toContain("性別による傾向");
    }
  });

  it("当たってると感じさせるフレーズ集が含まれないこと", () => {
    for (const prompt of allPrompts) {
      expect(prompt).not.toContain("当たってる！」と感じさせるフレーズ");
      expect(prompt).not.toContain("周りに頼られることが多いけれど");
      expect(prompt).not.toContain("大きな決断を先送りにしていませんか");
    }
  });
});

describe("システムプロンプト: 必須要素の存在", () => {
  const allPrompts = [CHAT_SYSTEM_PROMPT, ONESHOT_SYSTEM_PROMPT];

  it("アストレアの名前が含まれること", () => {
    for (const prompt of allPrompts) {
      expect(prompt).toContain("アストレア");
    }
  });

  it("占術を「鏡」「きっかけ」として位置づけていること", () => {
    // 少なくともどちらかのプロンプトに含まれる
    const combined = allPrompts.join(" ");
    expect(combined).toMatch(/鏡|きっかけ|ツール/);
  });

  it("感情ラベリングの指示が含まれること", () => {
    const combined = allPrompts.join(" ");
    expect(combined).toMatch(/感情.*言語化|感情.*名指し|感じて.*いる/);
  });

  it("開かれた質問の指示が含まれること", () => {
    const chatPrompt = CHAT_SYSTEM_PROMPT;
    expect(chatPrompt).toMatch(/どう感じ|心当たり|問いかけ/);
  });

  it("リフレクションの指示が含まれること", () => {
    const chatPrompt = CHAT_SYSTEM_PROMPT;
    expect(chatPrompt).toMatch(/言い換え|リフレクション|星の言葉/);
  });

  it("前向きな締めの指示が含まれること", () => {
    const combined = allPrompts.join(" ");
    expect(combined).toMatch(/前向き|希望|エンパワーメント|大丈夫/);
  });

  it("占術計算結果を正直に伝える指示が含まれること", () => {
    const combined = allPrompts.join(" ");
    expect(combined).toMatch(/正直|正確.*引用|計算結果.*変えない/);
  });

  it("「信じるな使え」的スタンスが含まれること", () => {
    const combined = allPrompts.join(" ");
    expect(combined).toMatch(/盲信|信じすぎ|参考|きっかけ|自分で決める/);
  });
});

describe("システムプロンプト: 対話フロー（チャット版のみ）", () => {
  it("フェーズ1: 生年月日を聞くフェーズが含まれること", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/生年月日/);
  });

  it("フェーズ2: 占術結果を提示するフェーズが含まれること", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/占術|計算結果|星盤/);
  });

  it("フェーズ4: 本鑑定フェーズが含まれること", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/本鑑定|統合/);
  });
});
