import { describe, expect, test } from "vitest";
import {
  SPREADS,
  findSpread,
  labelsByRevealOrder,
  nextPositionLabel,
  parseSpreadId,
  spreadChoicesForPrompt,
  spreadToPromptContext,
} from "./tarot-spread";

describe("SPREADS の定義", () => {
  test("5 種そろっている", () => {
    expect(SPREADS).toHaveLength(5);
  });

  test("どのスプレッドも 3 枚ぶんの位置を持つ", () => {
    for (const s of SPREADS) {
      expect(s.positions, s.id).toHaveLength(3);
    }
  });

  test("id が重複していない", () => {
    const ids = SPREADS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("各位置に短いラベルと意味の説明がある", () => {
    for (const s of SPREADS) {
      for (const p of s.positions) {
        expect(p.label.length, `${s.id} label`).toBeGreaterThan(0);
        expect(p.label.length, `${s.id} label は画面に出るので短く`).toBeLessThanOrEqual(8);
        expect(p.meaning.length, `${s.id} meaning`).toBeGreaterThan(5);
      }
    }
  });

  test("どんな相談に向くかが書いてある（提示時の判断材料になる）", () => {
    for (const s of SPREADS) {
      expect(s.suitedFor.length, s.id).toBeGreaterThan(5);
    }
  });
});

describe("parseSpreadId", () => {
  // モデルに 3 つ提示させる以上、存在しない id を返してくる可能性がある。
  // validation.ts と同じ流儀で、サーバ側の定義に必ず照合する。
  test("定義済みの id を受理する", () => {
    expect(parseSpreadId("timeline")).toEqual({ ok: true, value: "timeline" });
  });

  test("知らない id は拒否する（モデルの捏造を通さない）", () => {
    expect(parseSpreadId("celtic-cross").ok).toBe(false);
    expect(parseSpreadId("").ok).toBe(false);
  });

  test("文字列以外は拒否する", () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      expect(parseSpreadId(bad).ok, `${JSON.stringify(bad)}`).toBe(false);
    }
  });
});

describe("findSpread", () => {
  test("id からスプレッドを引ける", () => {
    expect(findSpread("relation")?.positions[1].label).toBe("相手の気持ち");
  });

  test("知らない id は undefined", () => {
    expect(findSpread("nope")).toBeUndefined();
  });
});

describe("spreadToPromptContext", () => {
  const draws = [
    { name: "愚者", reversed: false },
    { name: "星", reversed: true },
    { name: "月", reversed: false },
  ];

  test("位置の意味と引いた札を対応づける", () => {
    const ctx = spreadToPromptContext("timeline", draws);
    expect(ctx).toContain("過去");
    expect(ctx).toContain("愚者");
    expect(ctx).toContain("現在");
    expect(ctx).toContain("星");
    expect(ctx).toContain("未来");
    expect(ctx).toContain("月");
  });

  test("スプレッド名を明示する", () => {
    expect(spreadToPromptContext("situation", draws)).toContain("現状と道");
  });

  test("正逆を表記する", () => {
    const ctx = spreadToPromptContext("timeline", draws);
    expect(ctx).toContain("正位置");
    expect(ctx).toContain("逆位置");
  });

  test("読み方の指示を含む（プロの実務: 物語として読む / 中央が核）", () => {
    const ctx = spreadToPromptContext("timeline", draws);
    expect(ctx).toMatch(/物語/);
    expect(ctx).toMatch(/中央|2枚目/);
  });

  test("知らない id なら null", () => {
    expect(spreadToPromptContext("nope", draws)).toBeNull();
  });

  test("札が 3 枚でなければ null", () => {
    expect(spreadToPromptContext("timeline", draws.slice(0, 2))).toBeNull();
  });
});

describe("spreadChoicesForPrompt", () => {
  test("全スプレッドを id・名前・向く相談の一覧で出す", () => {
    const text = spreadChoicesForPrompt();
    for (const s of SPREADS) {
      expect(text).toContain(s.id);
      expect(text).toContain(s.name);
    }
  });

  test("3 つ選ばせる指示を含む", () => {
    expect(spreadChoicesForPrompt()).toMatch(/3\s*つ/);
  });
});

describe("対話フローへの接続", () => {
  // route は client から spreadId を受け取り、位置の意味つきの文脈を作る。
  // spreadId が無い / 不正なときは、位置の意味なしの従来表記にフォールバックして
  // 鑑定自体は止めない（スプレッド選択は後から入った機能なので、
  // 選ばれていない会話でも成立させる必要がある）。
  test("選択済みなら位置の意味つきの文脈になる", () => {
    const ctx = spreadToPromptContext("situation", [
      { name: "愚者", reversed: false },
      { name: "塔", reversed: true },
      { name: "星", reversed: false },
    ]);
    expect(ctx).toContain("障害");
    expect(ctx).toContain("塔");
  });

  test("未選択なら null を返し、呼び出し側が従来表記へ落とせる", () => {
    expect(spreadToPromptContext("", [])).toBeNull();
  });

  test("選択肢一覧に捏造を禁じる指示が入っている", () => {
    expect(spreadChoicesForPrompt()).toMatch(/勝手に作らない/);
  });

  test("各スプレッドの suitedFor が重複していない（3つ選ぶ判断材料になる）", () => {
    const s = SPREADS.map((x) => x.suitedFor);
    expect(new Set(s).size).toBe(s.length);
  });
});

describe("位置ラベルは画面の並びではなく「めくった順」に付く", () => {
  // ここが設計の要。orderByReveal が引き順を並べ替えるので、位置 1 は
  // 「左端の札」ではなく「最初にタップした札」である。
  // 画面のラベルを座標に固定すると、鑑定に渡す位置と表示が食い違う。
  const timeline = findSpread("timeline")!; // 過去 / 現在 / 未来

  test("最初にタップした札が第1の位置になる（左端ではない）", () => {
    // 真ん中(1) → 右(2) → 左(0) の順にめくった場合
    const labels = labelsByRevealOrder(timeline, [1, 2, 0], 3);
    expect(labels[1]).toBe("過去");
    expect(labels[2]).toBe("現在");
    expect(labels[0]).toBe("未来");
  });

  test("まだめくっていない札はラベルなし（先に見せると選択を誘導する）", () => {
    expect(labelsByRevealOrder(timeline, [2], 3)).toEqual([null, null, "過去"]);
  });

  test("1枚もめくっていなければ全部ラベルなし", () => {
    expect(labelsByRevealOrder(timeline, [], 3)).toEqual([null, null, null]);
  });

  test("次にめくる札が何の位置になるかを事前に言える", () => {
    expect(nextPositionLabel(timeline, [])).toBe("過去");
    expect(nextPositionLabel(timeline, [1])).toBe("現在");
    expect(nextPositionLabel(timeline, [1, 2])).toBe("未来");
  });

  test("めくり終わったら次の位置は無い", () => {
    expect(nextPositionLabel(timeline, [1, 2, 0])).toBeNull();
  });
});
