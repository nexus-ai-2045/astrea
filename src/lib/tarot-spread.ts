// タロットのスプレッド（展開法）定義。
//
// 3 枚引きは実際のタロットで最も使われる基礎で、読み方に複数のバリエーションがある。
// プロ監修の 7 バリエーションのうち、対話型鑑定に合う 5 つを採用した
// (research/tarot-dialogue-design/report.md)。
// 除外したのは「一日の流れ(朝昼夜)」と「期間指定(1ヶ月後)」で、対話で深掘りするには
// 粒度が細かすぎるため。
//
// 使い方: アストレアが相談内容を聞いたうえで、この一覧から 3 つを提示する。
// 相談者が 1 つ選び、選んだスプレッドの位置の意味に沿って 3 枚を読む。
// 「どのスプレッドか」も「どの札を先にめくるか」も相談者が決めるので、
// 選択が二重に効く設計になっている。

export interface SpreadPosition {
  /** 画面のカード下に出す短いラベル */
  label: string;
  /** 鑑定プロンプトに渡す、その位置が何を表すかの説明 */
  meaning: string;
}

export interface Spread {
  id: string;
  name: string;
  /** どんな相談に向くか。アストレアが 3 つ選ぶときの判断材料 */
  suitedFor: string;
  positions: [SpreadPosition, SpreadPosition, SpreadPosition];
}

export const SPREADS: Spread[] = [
  {
    id: "timeline",
    name: "時の流れ",
    suitedFor: "漠然とした不安、人生の節目、物事の流れを掴みたいとき",
    positions: [
      { label: "過去", meaning: "いまに影響を与えている過去の出来事" },
      { label: "現在", meaning: "相談者が置かれている今の状況" },
      { label: "未来", meaning: "この流れの先に訪れようとしているもの" },
    ],
  },
  {
    id: "situation",
    name: "現状と道",
    suitedFor: "具体的な悩み、決断、次の行動を決めたいとき",
    positions: [
      { label: "状況", meaning: "いま実際に起きていること" },
      { label: "障害", meaning: "前に進むのを妨げている課題" },
      { label: "助言", meaning: "その障害を越えるためのヒント" },
    ],
  },
  {
    id: "relation",
    name: "二人の間",
    suitedFor: "恋愛、家族、職場など、特定の相手との関係の悩み",
    positions: [
      { label: "あなた", meaning: "相談者自身の気持ち" },
      { label: "相手の気持ち", meaning: "相手の側にある感情や状態" },
      { label: "関係の行方", meaning: "二人の関係が向かっている方向" },
    ],
  },
  {
    id: "choice",
    name: "分かれ道",
    suitedFor: "二つの選択肢で迷っているとき",
    positions: [
      { label: "選択肢A", meaning: "一方を選んだ場合に開ける道" },
      { label: "選択肢B", meaning: "もう一方を選んだ場合に開ける道" },
      { label: "決め手", meaning: "選ぶうえで鍵になる視点" },
    ],
  },
  {
    id: "mindbody",
    name: "心と身体",
    suitedFor: "疲れ、不調、何となく満たされないとき",
    positions: [
      { label: "心", meaning: "感情や思考の状態" },
      { label: "身体", meaning: "身体が発しているサイン" },
      { label: "魂", meaning: "奥にある本当の願い" },
    ],
  },
];

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * スプレッド id を検証する。
 *
 * 3 つの提示はモデルに任せるので、存在しない id を返してくる可能性がある
 * (「ケルト十字で占いましょう」等)。プロンプト注入対策と同じ流儀で、
 * サーバ側の定義に必ず照合してから使う。
 */
export function parseSpreadId(value: unknown): Parsed<string> {
  if (typeof value !== "string" || !SPREADS.some((s) => s.id === value)) {
    return { ok: false, error: "unknown spread id" };
  }
  return { ok: true, value };
}

export function findSpread(id: string): Spread | undefined {
  return SPREADS.find((s) => s.id === id);
}

export interface DrawnCard {
  name: string;
  reversed: boolean;
}

/**
 * 選ばれたスプレッドと引いた 3 枚を、鑑定プロンプト用の文脈にする。
 *
 * 位置の意味を明示しないと、モデルは「1枚目/2枚目/3枚目」としか扱えない。
 * あわせてプロの実務知（3 枚を物語として読む / 中央が核）を指示として載せる。
 */
export function spreadToPromptContext(
  spreadId: string,
  draws: readonly DrawnCard[],
): string | null {
  const spread = findSpread(spreadId);
  if (!spread || draws.length !== spread.positions.length) return null;

  const lines = spread.positions.map((pos, i) => {
    const card = draws[i];
    const orientation = card.reversed ? "逆位置" : "正位置";
    return `${i + 1}枚目【${pos.label}】${orientation}「${card.name}」\n  この位置が示すもの: ${pos.meaning}`;
  });

  return [
    `【タロット鑑定 — ${spread.name}】`,
    `相談者が自ら選んだ展開法。めくった順がそのまま位置になっている。`,
    "",
    ...lines,
    "",
    "読み方: 3 枚をばらばらに解説せず、ひとつの物語として繋げて読むこと。",
    "中央（2枚目）を核とし、1枚目と3枚目はそれを補完するものとして扱う。",
  ].join("\n");
}

/**
 * 各札に付く位置ラベルを、めくった順で決める。戻り値は札の index 順。
 *
 * 位置は画面の並びではなく **めくった順** で決まる (orderByReveal と同じ規則)。
 * 座標にラベルを固定すると、鑑定へ渡す位置と画面表示が食い違う。
 * まだめくっていない札は null。先にラベルを見せると「どれを選ぶか」を誘導して
 * しまい、相談者が選ぶという設計の前提が崩れる。
 */
export function labelsByRevealOrder(
  spread: Spread,
  revealedOrder: readonly number[],
  total: number,
): (string | null)[] {
  const labels: (string | null)[] = new Array(total).fill(null);
  revealedOrder.forEach((cardIndex, order) => {
    const position = spread.positions[order];
    if (position && cardIndex >= 0 && cardIndex < total) {
      labels[cardIndex] = position.label;
    }
  });
  return labels;
}

/**
 * 次にめくる札がどの位置になるかを返す。めくり終わっていれば null。
 *
 * 「めくる順番ならちゃんとそう伝えないと分からない」(2026-07-28 CEO) への対応。
 * タップ前に予告することで、順番が選択であることが画面から分かる。
 */
export function nextPositionLabel(
  spread: Spread,
  revealedOrder: readonly number[],
): string | null {
  return spread.positions[revealedOrder.length]?.label ?? null;
}

/** アストレアに 3 つ選ばせるための一覧。 */
export function spreadChoicesForPrompt(): string {
  const list = SPREADS.map(
    (s) => `- ${s.id} 「${s.name}」… ${s.suitedFor}`,
  ).join("\n");

  return [
    "【展開法の選択肢】",
    list,
    "",
    "相談内容にふさわしいものを3つ選び、相談者に提示して1つ選んでもらうこと。",
    "一覧に無い展開法を勝手に作らないこと。",
  ].join("\n");
}
