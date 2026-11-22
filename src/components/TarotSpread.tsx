"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { tarotArtSrc } from "@/lib/tarot-art";
import {
  appendReveal,
  isSpreadComplete,
  orderByReveal,
} from "@/lib/tarot-reveal";

// 型は src/lib/tarot.ts が正本。ここで再定義すると page.tsx 側と食い違う
// (実際に upright/reversed/element 欠落で型エラーになった)。
import type { TarotDraw } from "@/lib/tarot";
import {
  labelsByRevealOrder,
  nextPositionLabel,
  type Spread,
} from "@/lib/tarot-spread";

interface TarotSpreadProps {
  draws: TarotDraw[];
  onComplete: (orderedDraws: TarotDraw[]) => void;
  /** 相談者が選んだ展開法。未選択でも札はめくれる (従来動作を壊さない) */
  spread?: Spread;
}

const ROMAN_NUMERALS: Record<number, string> = {
  0: "0",
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
  10: "X",
  11: "XI",
  12: "XII",
  13: "XIII",
  14: "XIV",
  15: "XV",
  16: "XVI",
  17: "XVII",
  18: "XVIII",
  19: "XIX",
  20: "XX",
  21: "XXI",
};

function toRoman(n: number): string {
  return ROMAN_NUMERALS[n] ?? String(n);
}

export default function TarotSpread({
  draws,
  onComplete,
  spread,
}: TarotSpreadProps) {
  // めくった順を保持する。順序そのものが「選択」の意味になるので Set ではなく配列。
  const [revealedOrder, setRevealedOrder] = useState<number[]>([]);
  const allRevealed = isSpreadComplete(revealedOrder, draws.length);

  // タップした札「だけ」が開く。ほかは伏せたまま。
  const handleCardClick = useCallback(
    (index: number) => {
      setRevealedOrder((prev) => appendReveal(index, prev, draws.length));
    },
    [draws.length],
  );

  // 全部めくり終えたら、めくった順に並べ替えて次へ進む。
  //
  // 旧実装は同じ effect の中で setAllRevealed(true) を呼んでいた。依存配列に
  // allRevealed があるため再レンダーで cleanup が走り、clearTimeout が
  // onComplete の timer を必ず取り消していた。結果 onComplete は一度も
  // 呼ばれず「次に進まない」状態だった (2026-07-28 CEO 報告 / 原因確定)。
  // 派生値は state にせず計算で出し、発火済みかは ref で持つ。
  const completedRef = useRef(false);
  useEffect(() => {
    if (!allRevealed || completedRef.current) return;
    completedRef.current = true;
    const ordered = orderByReveal(draws, revealedOrder);
    const timer = setTimeout(() => onComplete(ordered), 1200);
    return () => clearTimeout(timer);
  }, [allRevealed, draws, revealedOrder, onComplete]);

  // 位置は画面の並びではなく「めくった順」に決まる。座標に固定しないこと。
  const labels = spread
    ? labelsByRevealOrder(spread, revealedOrder, draws.length)
    : null;
  const nextLabel = spread ? nextPositionLabel(spread, revealedOrder) : null;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {spread ? (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs tracking-[0.2em] text-purple-300/50">
            {spread.name} — めくった順に
            {spread.positions.map((p) => `【${p.label}】`).join("")}
            として読みます
          </p>
          <p
            className="text-[11px] tracking-wider text-amber-200/60"
            aria-live="polite"
          >
            {nextLabel
              ? `次にめくる札が【${nextLabel}】になります`
              : "三枚そろいました"}
          </p>
        </div>
      ) : (
        <p className="text-xs tracking-[0.3em] text-purple-300/40">
          カードをタップして運命を開く
        </p>
      )}

      <div
        className="flex items-center justify-center"
        role="group"
        aria-label="タロットカード3枚"
      >
        {draws.map((draw, index) => {
          // この札に割り当てられた位置。まだめくっていなければ null
          const label = labels?.[index] ?? null;
          return (
          <div
            key={index}
            className="tarot-card-slot"
            style={{
              marginLeft: index === 0 ? 0 : "-16px",
              zIndex: index,
              transform: `rotate(${(index - 1) * 5}deg)`,
            }}
          >
            <button
              type="button"
              onClick={() => handleCardClick(index)}
              disabled={revealedOrder.includes(index)}
              className={`tarot-card ${revealedOrder.includes(index) ? "tarot-card--revealed" : "tarot-card--hidden"} ${allRevealed ? "tarot-card--complete" : ""}`}
              aria-label={
                revealedOrder.includes(index)
                  ? `${labels?.[index] ? `${labels[index]}: ` : ""}${draw.card.name}${draw.isReversed ? "（逆位置）" : "（正位置）"}`
                  : nextLabel
                    ? `カード ${index + 1}（未開封 / めくると${nextLabel}になります）`
                    : `カード ${index + 1}（未開封）`
              }
            >
              {/* カード裏面 */}
              <div className="tarot-card__back">
                <div className="tarot-card__back-pattern">
                  {/* 五芒星パターン（CSS） */}
                  <div className="tarot-card__pentagram" />
                  <div className="tarot-card__border-inner" />
                </div>
              </div>

              {/* カード表面。図案が用意できた札は画像、それ以外は下の CSS デザイン */}
              <div className="tarot-card__front">
                {tarotArtSrc(draw.card.number) && (
                  <img
                    src={tarotArtSrc(draw.card.number)!}
                    alt=""
                    aria-hidden="true"
                    className={`tarot-card__art ${draw.isReversed ? "rotate-180" : ""}`}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="flex h-full flex-col items-center justify-between p-3">
                  <span className="flex w-full items-baseline justify-between gap-1">
                    <span className="text-[10px] tracking-widest text-amber-200/60">
                      {toRoman(draw.card.number)}
                    </span>
                    {label !== null && (
                      <span className="rounded-sm bg-amber-200/10 px-1.5 py-0.5 text-[9px] tracking-wider text-amber-100/80">
                        {label}
                      </span>
                    )}
                  </span>

                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`text-2xl ${draw.isReversed ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      {draw.isReversed ? "☽" : "☀"}
                    </span>
                    <span className="text-center text-sm font-medium leading-tight tracking-wider text-purple-50">
                      {draw.card.name}
                    </span>
                    <span className="text-[9px] tracking-wider text-purple-300/50">
                      {draw.card.nameEn}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`text-[10px] tracking-wider ${draw.isReversed ? "text-pink-300/70" : "text-amber-200/70"}`}
                    >
                      {draw.isReversed ? "逆位置" : "正位置"}
                    </span>
                    <div className="flex flex-wrap justify-center gap-1">
                      {draw.card.keywords.slice(0, 2).map((kw, ki) => (
                        <span
                          key={ki}
                          className="rounded-full border border-purple-400/20 px-2 py-0.5 text-[8px] text-purple-200/60"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}
