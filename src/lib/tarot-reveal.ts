// タロットを「選んだ感じ」で開くためのロジック。
//
// 仕様の変遷:
//  - 初期実装は `if (index !== revealedCards.size) return;` で左端しか押せず、
//    2枚目3枚目が無反応だった (2026-07-28 CEO 報告)
//  - 次に「1枚選ぶと残りも順に開く」に直したが、選んだ意味が薄れるうえ
//    「ほかがめくれるのは困る」となった (同日 CEO 指摘)
//  - 現行: **タップした札だけが開く**。3枚とも自分でめくる。
//    ランダム性 (どの札がどこにあるか) は伏せたまま残し、選択感を最大化する。

/** 押せるかどうか。開いている札と範囲外は押せない。 */
export function canReveal(
  index: number,
  revealed: readonly number[],
  total: number,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= total) return false;
  return !revealed.includes(index);
}

/** 押した結果の新しいめくり順。押せない場合は元の配列をそのまま返す。 */
export function appendReveal(
  index: number,
  revealed: readonly number[],
  total: number,
): number[] {
  if (!canReveal(index, revealed, total)) return [...revealed];
  return [...revealed, index];
}

/** 全部めくり終えたか。 */
export function isSpreadComplete(
  revealed: readonly number[],
  total: number,
): boolean {
  return total > 0 && revealed.length === total;
}

/**
 * めくった順に札を並べ替える。
 *
 * 相談者が選んだ順が 1枚目 / 2枚目 / 3枚目 になる。これがあるから
 * 「どれを選ぶか」に意味が生まれる。鑑定へ送るのもこの順。
 */
export function orderByReveal<T>(items: readonly T[], revealed: readonly number[]): T[] {
  return revealed
    .filter((i) => Number.isInteger(i) && i >= 0 && i < items.length)
    .map((i) => items[i]);
}
