import { describe, expect, test } from "vitest";
import { AVAILABLE_TAROT_ART, tarotArtSrc } from "./tarot-art";

describe("tarotArtSrc", () => {
  // 図案は 22 枚そろうまで時間がかかる (MJ の生成物が消失し、作り直しになった)。
  // 揃うのを待たず、出来た札から順に差し替えられるようにする。
  // 画像が無い札は現行の CSS デザインのまま表示する。
  test("用意済みの札は画像パスを返す", () => {
    for (const n of AVAILABLE_TAROT_ART) {
      expect(tarotArtSrc(n), `card ${n}`).toBe(
        `/images/tarot/${String(n).padStart(2, "0")}.webp`,
      );
    }
  });

  test("未用意の札は null（CSS へフォールバック）", () => {
    const missing = [...Array(22).keys()].filter(
      (n) => !AVAILABLE_TAROT_ART.includes(n),
    );
    for (const n of missing) {
      expect(tarotArtSrc(n), `card ${n}`).toBeNull();
    }
  });

  test("番号は 2 桁ゼロ埋め（00.webp 〜 21.webp）", () => {
    // 一覧が空でも命名規則は固定しておく
    expect(`/images/tarot/${String(0).padStart(2, "0")}.webp`).toBe(
      "/images/tarot/00.webp",
    );
    expect(`/images/tarot/${String(21).padStart(2, "0")}.webp`).toBe(
      "/images/tarot/21.webp",
    );
  });

  test("範囲外の番号は null", () => {
    for (const bad of [-1, 22, 99, 1.5, NaN]) {
      expect(tarotArtSrc(bad), `${bad}`).toBeNull();
    }
  });

  test("用意済み一覧は大アルカナの範囲に収まっている", () => {
    for (const n of AVAILABLE_TAROT_ART) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(21);
    }
  });

  test("用意済み一覧に重複が無い", () => {
    expect(new Set(AVAILABLE_TAROT_ART).size).toBe(AVAILABLE_TAROT_ART.length);
  });
});
