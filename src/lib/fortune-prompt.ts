// `claude -p` の stdin へ流す本文を組み立てる。
//
// system prompt には固定の人格文字列しか渡さない (argv 長制限の回避と、
// ユーザー由来の文字列が system 側へ回り込まないことの構造的な保証)。
// 占術結果・タロット・RAG・会話履歴はすべてこちらに載せる。

export interface PromptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FortunePromptInput {
  /** 生年月日から算出した命式。未検出なら null */
  fortuneContext: string | null;
  /** 過去の高スコアセッションから作った参考パターン。無ければ null */
  ragContext: string | null;
  /** サーバ側の deck から組み立てたタロット解釈。無ければ null */
  tarotContext: string | null;
  /** これまでの会話 (今回の発話を含む) */
  history: PromptMessage[];
}

const SEEKER = "相談者";
const ORACLE = "アストレア";

/** 会話が空のときに送る、フェーズ1の出迎えを促す指示。 */
export const OPENING_INSTRUCTION =
  "（新しい相談者が来ました。フェーズ1の出迎えメッセージを送ってください。" +
  "温かく迎え入れて、生年月日だけを聞いてください。他の情報はまだ聞かないこと）";

/** 話者名や見出しを勝手に付けさせないための締め。 */
const TAIL_INSTRUCTION =
  `${ORACLE}として、続きの返答を1つだけ書いてください。` +
  `見出しや「${ORACLE}:」といった話者名は付けず、本文だけを返してください。`;

export interface FortuneTurnPromptInput {
  /** このターンで新しく判明した命式。既に伝えてあるなら null */
  fortuneContext: string | null;
  /** 参考パターン。命式と同じターンにだけ載せる */
  ragContext: string | null;
  /** このターンで引いたタロット。無ければ null */
  tarotContext: string | null;
  /** 今回の相談者の発話。開幕 (発話なし) なら null */
  message: string | null;
}

/**
 * 常駐プロセスへ送る「差分だけ」の本文。
 *
 * 常駐プロセスは会話文脈を自分で保持するので、過去のやりとりを送り直さない。
 * 現行どおり毎ターン 2900 字を再送すると 2 ターン目の最初の文字が
 * 1202ms → 2433ms に劣化した (2026-07-28 実測)。
 *
 * プロセスが落ちた / 回収された場合は文脈が無いので buildFortunePrompt (全文) を使う。
 */
export function buildFortuneTurnPrompt(input: FortuneTurnPromptInput): string {
  const sections: string[] = [];

  if (input.fortuneContext) sections.push(input.fortuneContext);
  if (input.tarotContext) sections.push(input.tarotContext);
  if (input.ragContext) sections.push(input.ragContext);

  if (input.message) {
    sections.push(`${SEEKER}: ${input.message}`);
  } else if (sections.length === 0) {
    return OPENING_INSTRUCTION;
  }

  sections.push(TAIL_INSTRUCTION);
  return sections.join("\n\n");
}

export function buildFortunePrompt(input: FortunePromptInput): string {
  const sections: string[] = [];

  if (input.fortuneContext) sections.push(input.fortuneContext);
  if (input.tarotContext) sections.push(input.tarotContext);
  if (input.ragContext) sections.push(input.ragContext);

  if (input.history.length === 0) {
    sections.push(OPENING_INSTRUCTION);
    return sections.join("\n\n");
  }

  const transcript = input.history
    .map((m) => `${m.role === "user" ? SEEKER : ORACLE}: ${m.content}`)
    .join("\n\n");

  sections.push(
    [
      "=== これまでのやりとり ===",
      transcript,
      "=== ここまで ===",
      "",
      TAIL_INSTRUCTION,
    ].join("\n"),
  );

  return sections.join("\n\n");
}
