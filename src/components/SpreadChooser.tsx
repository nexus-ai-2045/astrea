"use client";

// 展開法を相談者に選んでもらう画面。
//
// アストレアは会話の流れから 3 つを「言葉で」勧める (system prompt フェーズ2)。
// 選ぶ手段はこの一覧で、勧められた 3 つ以外も選べる。
// モデルの推薦で一覧を絞り込まないのは、モデルが返す id を信用して UI を
// 組み立てると、存在しない展開法や勧めていない組み合わせが出たときに
// 画面が壊れるため。推薦は言葉、選択は固定一覧、と経路を分けておく。

import type { Spread } from "@/lib/tarot-spread";

interface SpreadChooserProps {
  spreads: readonly Spread[];
  onSelect: (spreadId: string) => void;
}

export default function SpreadChooser({
  spreads,
  onSelect,
}: SpreadChooserProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-xs tracking-[0.3em] text-purple-300/40">
        読み方を選んでください
      </p>

      <div
        className="grid w-full gap-2 sm:grid-cols-2"
        role="group"
        aria-label="展開法の一覧"
      >
        {spreads.map((spread) => (
          <button
            key={spread.id}
            type="button"
            onClick={() => onSelect(spread.id)}
            className="group rounded-lg border border-purple-400/20 px-4 py-3 text-left transition hover:border-amber-200/40 hover:bg-purple-500/5"
          >
            <span className="flex items-baseline gap-2">
              <span className="text-sm tracking-wider text-purple-50">
                {spread.name}
              </span>
              <span className="text-[10px] tracking-wider text-amber-200/50">
                {spread.positions.map((p) => p.label).join(" · ")}
              </span>
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-purple-200/50">
              {spread.suitedFor}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
