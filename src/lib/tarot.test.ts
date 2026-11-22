import { describe, it, expect } from "vitest";
import {
  drawCards,
  tarotDrawToPromptContext,
  MAJOR_ARCANA,
  type TarotDraw,
} from "./tarot";

describe("tarot", () => {
  describe("MAJOR_ARCANA", () => {
    it("22枚の大アルカナが定義されている", () => {
      expect(MAJOR_ARCANA).toHaveLength(22);
    });

    it("各カードに必須フィールドがある", () => {
      for (const card of MAJOR_ARCANA) {
        expect(card.number).toBeGreaterThanOrEqual(0);
        expect(card.number).toBeLessThanOrEqual(21);
        expect(card.name).toBeTruthy();
        expect(card.nameEn).toBeTruthy();
        expect(card.upright).toBeTruthy();
        expect(card.reversed).toBeTruthy();
        expect(card.keywords.length).toBeGreaterThanOrEqual(3);
        expect(card.element).toBeTruthy();
      }
    });

    it("番号に重複がない", () => {
      const numbers = MAJOR_ARCANA.map((c) => c.number);
      expect(new Set(numbers).size).toBe(22);
    });
  });

  describe("drawCards", () => {
    it("指定枚数のカードを引ける", () => {
      const draws = drawCards(3);
      expect(draws).toHaveLength(3);
    });

    it("引いたカードに重複がない", () => {
      const draws = drawCards(5);
      const numbers = draws.map((d) => d.card.number);
      expect(new Set(numbers).size).toBe(5);
    });

    it("各カードに正位置/逆位置が設定されている", () => {
      const draws = drawCards(3);
      for (const draw of draws) {
        expect(typeof draw.isReversed).toBe("boolean");
      }
    });

    it("不正な枚数でエラーを投げる", () => {
      expect(() => drawCards(0)).toThrow();
      expect(() => drawCards(23)).toThrow();
    });

    it("100回引いて逆位置が出ることを確認（偏りすぎない）", () => {
      let reversedCount = 0;
      for (let i = 0; i < 100; i++) {
        const draws = drawCards(1);
        if (draws[0].isReversed) reversedCount++;
      }
      // 期待値30%。5-60%の範囲なら正常（暗号乱数なので偏りは極小）
      expect(reversedCount).toBeGreaterThan(5);
      expect(reversedCount).toBeLessThan(60);
    });

    it("100回引いてカードにばらつきがある", () => {
      const cardCounts = new Map<number, number>();
      for (let i = 0; i < 100; i++) {
        const draws = drawCards(1);
        const num = draws[0].card.number;
        cardCounts.set(num, (cardCounts.get(num) ?? 0) + 1);
      }
      // 100回引いて少なくとも10種類以上のカードが出るはず
      expect(cardCounts.size).toBeGreaterThan(10);
    });
  });

  describe("tarotDrawToPromptContext", () => {
    it("プロンプトコンテキスト文字列を生成する", () => {
      const draws: TarotDraw[] = [
        { card: MAJOR_ARCANA[16], isReversed: false }, // 塔
        { card: MAJOR_ARCANA[17], isReversed: true }, // 星（逆）
        { card: MAJOR_ARCANA[21], isReversed: false }, // 世界
      ];
      const context = tarotDrawToPromptContext(draws);

      expect(context).toContain("【タロット鑑定】");
      expect(context).toContain("1枚目: 正位置「塔」");
      expect(context).toContain("2枚目: 逆位置「星」");
      expect(context).toContain("3枚目: 正位置「世界」");
      expect(context).toContain("The Tower");
      expect(context).toContain("The Star");
      expect(context).toContain("The World");
    });

    it("正位置と逆位置で異なる意味が出る", () => {
      const card = MAJOR_ARCANA[0]; // 愚者
      const upright: TarotDraw[] = [{ card, isReversed: false }];
      const reversed: TarotDraw[] = [{ card, isReversed: true }];

      const uprightCtx = tarotDrawToPromptContext(upright);
      const reversedCtx = tarotDrawToPromptContext(reversed);

      expect(uprightCtx).toContain(card.upright);
      expect(reversedCtx).toContain(card.reversed);
      expect(uprightCtx).not.toEqual(reversedCtx);
    });
  });
});
