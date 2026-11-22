// セッション自動採点テスト — PDCA最小実装
// TDD: RED → GREEN → REFACTOR

import { describe, it, expect } from "vitest";
import {
  detectSignals,
  calculateSessionScore,
  scoreSession,
  type SessionMessage,
  type SignalResult,
  type SessionScoreResult,
} from "./session-scorer";

describe("detectSignals: ユーザー反応からシグナルを検出", () => {
  it("ポジティブシグナルを検出できること", () => {
    const messages: SessionMessage[] = [
      {
        role: "assistant",
        content: "あなたの日干は庚。鉄鋼のような意志の強さ...",
      },
      { role: "user", content: "えっ、当たってます！まさにそうなんです" },
    ];
    const result = detectSignals(messages);
    expect(result.positiveCount).toBeGreaterThanOrEqual(1);
  });

  it("ネガティブシグナルを検出できること", () => {
    const messages: SessionMessage[] = [
      {
        role: "assistant",
        content: "あなたは社交的で人を引きつける力が...",
      },
      { role: "user", content: "うーん、ちょっと違うかもしれないです" },
    ];
    const result = detectSignals(messages);
    expect(result.negativeCount).toBeGreaterThanOrEqual(1);
  });

  it("中立的な反応はどちらにもカウントしないこと", () => {
    const messages: SessionMessage[] = [
      { role: "assistant", content: "あなたの五行バランスは..." },
      { role: "user", content: "なるほど、続けてください" },
    ];
    const result = detectSignals(messages);
    expect(result.positiveCount).toBe(0);
    expect(result.negativeCount).toBe(0);
  });

  it("複数のシグナルを正しくカウントすること", () => {
    const messages: SessionMessage[] = [
      { role: "assistant", content: "日干は甲。大木のような成長力..." },
      { role: "user", content: "すごい！当たってる！" },
      { role: "assistant", content: "恋愛面では慎重な傾向が..." },
      { role: "user", content: "それはちょっと違うかな" },
      { role: "assistant", content: "仕事面では完璧主義な一面が..." },
      { role: "user", content: "そうなんです！まさにそれです" },
    ];
    const result = detectSignals(messages);
    expect(result.positiveCount).toBe(2);
    expect(result.negativeCount).toBe(1);
  });

  it("アシスタントのメッセージはカウントしないこと", () => {
    const messages: SessionMessage[] = [
      {
        role: "assistant",
        content: "当たってますよね。すごいですよね",
      },
    ];
    const result = detectSignals(messages);
    expect(result.positiveCount).toBe(0);
    expect(result.negativeCount).toBe(0);
  });
});

describe("calculateSessionScore: セッション全体のスコア算出", () => {
  it("ポジティブのみのセッションは高スコアになること", () => {
    const signals: SignalResult = { positiveCount: 3, negativeCount: 0 };
    const messageCount = 8;
    const score = calculateSessionScore(signals, messageCount);
    expect(score).toBeGreaterThanOrEqual(4);
    expect(score).toBeLessThanOrEqual(5);
  });

  it("ネガティブのみのセッションは低スコアになること", () => {
    const signals: SignalResult = { positiveCount: 0, negativeCount: 3 };
    const messageCount = 8;
    const score = calculateSessionScore(signals, messageCount);
    expect(score).toBeLessThanOrEqual(2);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it("混在するセッションは中間スコアになること", () => {
    const signals: SignalResult = { positiveCount: 2, negativeCount: 2 };
    const messageCount = 10;
    const score = calculateSessionScore(signals, messageCount);
    expect(score).toBeGreaterThanOrEqual(2.5);
    expect(score).toBeLessThanOrEqual(3.5);
  });

  it("メッセージ数が多い（没入している）とボーナスがつくこと", () => {
    const signals: SignalResult = { positiveCount: 1, negativeCount: 0 };
    const shortSession = calculateSessionScore(signals, 4);
    const longSession = calculateSessionScore(signals, 12);
    expect(longSession).toBeGreaterThan(shortSession);
  });

  it("スコアは1〜5の範囲に収まること", () => {
    const extremePositive: SignalResult = {
      positiveCount: 100,
      negativeCount: 0,
    };
    const extremeNegative: SignalResult = {
      positiveCount: 0,
      negativeCount: 100,
    };
    expect(calculateSessionScore(extremePositive, 200)).toBeLessThanOrEqual(5);
    expect(calculateSessionScore(extremeNegative, 200)).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("シグナルなしの場合はベースライン（3）付近になること", () => {
    const noSignals: SignalResult = { positiveCount: 0, negativeCount: 0 };
    const score = calculateSessionScore(noSignals, 6);
    expect(score).toBeGreaterThanOrEqual(2.5);
    expect(score).toBeLessThanOrEqual(3.5);
  });
});

describe("scoreSession: 統合スコアリング関数", () => {
  it("メッセージ配列からスコア結果を一括算出できること", () => {
    const messages: SessionMessage[] = [
      { role: "assistant", content: "あなたの日干は庚..." },
      { role: "user", content: "当たってます！すごい" },
      { role: "assistant", content: "五行のバランスから見ると..." },
      { role: "user", content: "そうなんです、まさにそれです" },
      { role: "assistant", content: "本鑑定をお伝えします..." },
      { role: "user", content: "ありがとうございます" },
    ];
    const result = scoreSession(messages);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.signals.positiveCount).toBeGreaterThanOrEqual(1);
    expect(result.messageCount).toBe(6);
  });

  it("空のメッセージ配列でもエラーにならないこと", () => {
    const result = scoreSession([]);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.messageCount).toBe(0);
  });
});
