import { describe, it, expect } from "vitest";
import {
  calculateAllFortunes,
  extractBirthdayInfoFromMessages,
  extractBirthdayFromMessages,
} from "./fortune-engine";

describe("fortune-engine", () => {
  describe("calculateAllFortunes", () => {
    it("1990年5月15日の計算結果が正しい", () => {
      const result = calculateAllFortunes("1990年5月15日");
      expect(result).not.toBeNull();
      if (!result) return;

      // 西洋占星術: 5月15日は牡牛座
      expect(result.zodiac.sign).toBe("牡牛座");
      expect(result.zodiac.element).toBe("地");

      // 数秘術: 1+9+9+0+5+1+5 = 30 → 3
      expect(result.numerology.lifePath).toBe(3);

      // タロット: 3枚引かれている
      expect(result.tarot.past.card).toBeDefined();
      expect(result.tarot.present.card).toBeDefined();
      expect(result.tarot.future.card).toBeDefined();
    });

    it("2000年1月1日は山羊座", () => {
      const result = calculateAllFortunes("2000年1月1日");
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.zodiac.sign).toBe("山羊座");
    });

    it("1985年11月3日は蠍座", () => {
      const result = calculateAllFortunes("1985年11月3日");
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.zodiac.sign).toBe("蠍座");
    });

    it("和暦のパース", () => {
      const result = calculateAllFortunes("H2.5.15");
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.zodiac.sign).toBe("牡牛座");
    });

    it("スラッシュ区切り", () => {
      const result = calculateAllFortunes("1990/05/15");
      expect(result).not.toBeNull();
      expect(result!.zodiac.sign).toBe("牡牛座");
    });

    it("パース済みオブジェクトも受け取れる", () => {
      const result = calculateAllFortunes({ year: 1990, month: 5, day: 15 });
      expect(result).not.toBeNull();
      expect(result!.zodiac.sign).toBe("牡牛座");
    });

    it("6/21は蟹座（境界日）", () => {
      const result = calculateAllFortunes("1990年6月21日");
      expect(result!.zodiac.sign).toBe("蟹座");
    });

    it("6/22は蟹座", () => {
      const result = calculateAllFortunes("1990年6月22日");
      expect(result!.zodiac.sign).toBe("蟹座");
    });

    it("6/20は双子座", () => {
      const result = calculateAllFortunes("1990年6月20日");
      expect(result!.zodiac.sign).toBe("双子座");
    });

    it("10/23は蠍座（境界日）", () => {
      const result = calculateAllFortunes("1990年10月23日");
      expect(result!.zodiac.sign).toBe("蠍座");
    });

    it("10/24は蠍座", () => {
      const result = calculateAllFortunes("1990年10月24日");
      expect(result!.zodiac.sign).toBe("蠍座");
    });

    it("10/22は天秤座", () => {
      const result = calculateAllFortunes("1990年10月22日");
      expect(result!.zodiac.sign).toBe("天秤座");
    });

    it("全角数字", () => {
      const result = calculateAllFortunes("１９９０年５月１５日");
      expect(result!.zodiac.sign).toBe("牡牛座");
    });

    it("全角スラッシュ区切り", () => {
      const result = calculateAllFortunes("１９９０／０５／１５");
      expect(result!.zodiac.sign).toBe("牡牛座");
    });

    it("平成元年（1989年）", () => {
      const result = calculateAllFortunes("平成元年5月15日");
      expect(result!.zodiac.sign).toBe("牡牛座");
      // 平成元年 = 1989年
      expect(result!.numerology.lifePath).toBe(
        // 1+9+8+9+5+1+5 = 38 → 11 → 2
        2,
      );
    });

    it("H元.5.15（平成元年）", () => {
      const result = calculateAllFortunes("H元.5.15");
      expect(result!.zodiac.sign).toBe("牡牛座");
    });

    it("令和元年1月1日（2019年）", () => {
      const result = calculateAllFortunes("令和元年1月1日");
      expect(result).not.toBeNull();
      // 令和元年 = 2019年
      expect(result!.numerology.lifePath).toBeDefined();
    });

    it("読点区切り（全角カンマ）", () => {
      const result = calculateAllFortunes("1990年、5月、15日");
      // 年・月・日の区切りとして読点は無視→年パターンで吸収
      expect(result).not.toBeNull();
    });

    it("不正な入力はnullを返す", () => {
      expect(calculateAllFortunes("こんにちは")).toBeNull();
      expect(calculateAllFortunes("今日")).toBeNull();
    });

    it("存在しない日付はnullを返す（2月30日）", () => {
      expect(calculateAllFortunes("1990年2月30日")).toBeNull();
    });

    it("存在しない日付はnullを返す（4月31日）", () => {
      expect(calculateAllFortunes("1990年4月31日")).toBeNull();
    });

    it("存在しない日付はnullを返す（13月）", () => {
      expect(calculateAllFortunes("1990年13月1日")).toBeNull();
    });

    it("存在しない日付はnullを返す（うるう年でない2/29）", () => {
      expect(calculateAllFortunes("1990年2月29日")).toBeNull();
    });

    it("うるう年の2/29は有効", () => {
      expect(calculateAllFortunes("1992年2月29日")).not.toBeNull();
    });

    it("同じセッションIDでは同じタロットカードが引かれる", () => {
      const r1 = calculateAllFortunes("1990年5月15日", "session-abc");
      const r2 = calculateAllFortunes("1990年5月15日", "session-abc");
      expect(r1!.tarot.past.card.name).toBe(r2!.tarot.past.card.name);
      expect(r1!.tarot.present.card.name).toBe(r2!.tarot.present.card.name);
      expect(r1!.tarot.future.card.name).toBe(r2!.tarot.future.card.name);
    });

    it("異なるセッションIDでは異なるタロットカードが引かれる（高確率）", () => {
      const r1 = calculateAllFortunes("1990年5月15日", "session-111");
      const r2 = calculateAllFortunes("1990年5月15日", "session-222");
      // 3枚全部一致する確率は極めて低い
      const allSame =
        r1!.tarot.past.card.name === r2!.tarot.past.card.name &&
        r1!.tarot.present.card.name === r2!.tarot.present.card.name &&
        r1!.tarot.future.card.name === r2!.tarot.future.card.name;
      expect(allSame).toBe(false);
    });

    it("タロットの3枚は重複しない", () => {
      const result = calculateAllFortunes("1990年5月15日", "test-unique");
      if (!result) return;
      const names = [
        result.tarot.past.card.name,
        result.tarot.present.card.name,
        result.tarot.future.card.name,
      ];
      expect(new Set(names).size).toBe(3);
    });

    it("文字列入力とパース済み入力で同じ結果になる", () => {
      const fromString = calculateAllFortunes("1990/05/15", "test-session");
      const fromParsed = calculateAllFortunes(
        { year: 1990, month: 5, day: 15 },
        "test-session",
      );
      expect(fromParsed).toEqual(fromString);
    });
  });

  describe("extractBirthdayFromMessages", () => {
    it("ユーザーメッセージから生年月日を抽出", () => {
      const messages = [
        { role: "assistant", content: "生年月日を教えてください" },
        { role: "user", content: "1990年5月15日生まれ、男性です" },
      ];
      expect(extractBirthdayFromMessages(messages)).not.toBeNull();
    });

    it("生年月日がない場合はnull", () => {
      const messages = [{ role: "user", content: "仕事の相談をしたいです" }];
      expect(extractBirthdayFromMessages(messages)).toBeNull();
    });

    it("アシスタントのメッセージは無視", () => {
      const messages = [{ role: "assistant", content: "1990年5月15日ですね" }];
      expect(extractBirthdayFromMessages(messages)).toBeNull();
    });

    it("月日が先・年が後（口語パターン）", () => {
      const messages = [{ role: "user", content: "5月15日生まれ、1990年です" }];
      const result = extractBirthdayFromMessages(messages);
      expect(result).not.toBeNull();
      expect(calculateAllFortunes(result!)).not.toBeNull();
    });

    it("ドット区切り（1990.5.15）", () => {
      const messages = [{ role: "user", content: "誕生日は1990.5.15です" }];
      expect(extractBirthdayFromMessages(messages)).not.toBeNull();
    });

    it("複数メッセージ内の後続ユーザー発言から抽出", () => {
      const messages = [
        { role: "user", content: "こんにちは" },
        { role: "assistant", content: "生年月日を教えてください" },
        { role: "user", content: "1985年11月3日です" },
      ];
      expect(extractBirthdayFromMessages(messages)).not.toBeNull();
    });

    it("年が先・月日が後（口語パターン2）", () => {
      const messages = [
        { role: "user", content: "1990年生まれです。誕生日は5月15日" },
      ];
      const result = extractBirthdayFromMessages(messages);
      expect(result).not.toBeNull();
      expect(calculateAllFortunes(result!)).not.toBeNull();
    });

    it("スラッシュ月日＋年が後（5/15、1990年生まれ）", () => {
      const messages = [
        { role: "user", content: "5/15が誕生日で1990年生まれです" },
      ];
      const result = extractBirthdayFromMessages(messages);
      expect(result).not.toBeNull();
      expect(calculateAllFortunes(result!)).not.toBeNull();
    });

    it("生年月日情報を raw と parsed の両方で取得できる", () => {
      const messages = [
        { role: "assistant", content: "生年月日を教えてください" },
        { role: "user", content: "1990年5月15日生まれ、男性です" },
      ];
      const result = extractBirthdayInfoFromMessages(messages);
      expect(result).not.toBeNull();
      expect(result?.raw).toContain("1990年5月15日");
      expect(result?.parsed).toEqual({ year: 1990, month: 5, day: 15 });
      expect(calculateAllFortunes(result!.parsed)).not.toBeNull();
    });
  });
});
