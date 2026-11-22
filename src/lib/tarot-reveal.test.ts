import { describe, expect, test } from "vitest";
import {
  appendReveal,
  canReveal,
  isSpreadComplete,
  orderByReveal,
} from "./tarot-reveal";

describe("canReveal", () => {
  test("どの札でも押せる（左端縛りは廃止）", () => {
    expect(canReveal(0, [], 3)).toBe(true);
    expect(canReveal(1, [], 3)).toBe(true);
    expect(canReveal(2, [], 3)).toBe(true);
  });

  test("開いている札は押せない", () => {
    expect(canReveal(1, [1], 3)).toBe(false);
  });

  test("範囲外や非整数は押せない", () => {
    for (const bad of [-1, 3, 99, 1.5, NaN]) {
      expect(canReveal(bad, [], 3)).toBe(false);
    }
  });
});

describe("appendReveal", () => {
  test("押した札だけが増える（ほかは開かない）", () => {
    expect(appendReveal(2, [], 3)).toEqual([2]);
    expect(appendReveal(0, [2], 3)).toEqual([2, 0]);
    expect(appendReveal(1, [2, 0], 3)).toEqual([2, 0, 1]);
  });

  test("1回のタップで複数枚開かない", () => {
    expect(appendReveal(1, [], 3)).toHaveLength(1);
  });

  test("押せない札なら状態が変わらない", () => {
    expect(appendReveal(2, [2], 3)).toEqual([2]);
    expect(appendReveal(9, [0], 3)).toEqual([0]);
  });
});

describe("isSpreadComplete", () => {
  test("全部めくったら完了", () => {
    expect(isSpreadComplete([2, 0, 1], 3)).toBe(true);
  });

  test("途中では完了しない", () => {
    expect(isSpreadComplete([], 3)).toBe(false);
    expect(isSpreadComplete([2], 3)).toBe(false);
    expect(isSpreadComplete([2, 0], 3)).toBe(false);
  });

  test("札が無いときは完了扱いにしない", () => {
    expect(isSpreadComplete([], 0)).toBe(false);
  });
});

describe("orderByReveal", () => {
  const draws = ["A", "B", "C"];

  test("めくった順が 1枚目/2枚目/3枚目 になる（選択に意味を持たせる）", () => {
    expect(orderByReveal(draws, [2, 0, 1])).toEqual(["C", "A", "B"]);
    expect(orderByReveal(draws, [1, 2, 0])).toEqual(["B", "C", "A"]);
  });

  test("途中でも順序を保つ", () => {
    expect(orderByReveal(draws, [1])).toEqual(["B"]);
  });

  test("不正な index は無視する", () => {
    expect(orderByReveal(draws, [1, 99, -1, 0])).toEqual(["B", "A"]);
  });
});
