// 公開エンドポイントの入力検証。
//
// 方針: API route は認証なしで誰でも叩ける前提で書く。クライアントから来た値は
// 「形」だけでなく「上限」まで縛る。特に system prompt へ流れる値は文字列を
// 受け取らず、サーバ側の deck から復元する (prompt injection 経路を作らない)。

import { MAJOR_ARCANA, type TarotDraw } from "./tarot";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** 1 メッセージの上限。会話 1 往復あたりの token コストを縛るための値。 */
export const MAX_MESSAGE_CHARS = 2000;
/** 1 セッションで受け取るタロットの枚数上限 (UI は 3 枚)。 */
export const MAX_TAROT_DRAWS = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * sessionId は UUID のみ受理する。
 *
 * 任意文字列を通すと (1) DB の主キーを攻撃者が自由に決められる
 * (2) 連番など推測可能な ID を送られると他人のセッションに追記できる。
 */
export function parseSessionId(value: unknown): Parsed<string> {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    return { ok: false, error: "sessionId must be a UUID" };
  }
  return { ok: true, value };
}

/**
 * message は任意 (初回挨拶は message なしで来る)。
 * 文字数上限で 1 リクエストのコストを縛る。
 */
export function parseOptionalMessage(value: unknown): Parsed<string> {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: "" };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "message must be a string" };
  }
  if (value.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      error: `message must be ${MAX_MESSAGE_CHARS} characters or fewer`,
    };
  }
  return { ok: true, value };
}

type TarotDrawInput = { number: number; isReversed: boolean };

function isTarotDrawInput(value: unknown): value is TarotDrawInput {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.number === "number" &&
    Number.isInteger(candidate.number) &&
    typeof candidate.isReversed === "boolean"
  );
}

/**
 * タロットの抽選結果を「カード番号 + 正逆」だけ受け取り、deck から復元する。
 *
 * 以前はクライアントが `tarotDrawToPromptContext()` で組み立てた**文字列**を
 * 送り、それを system prompt に連結していた。任意の system prompt を注入できる
 * ため、汎用 LLM として使われたり人格を書き換えられる経路になっていた。
 * 番号だけ受け取れば、prompt に載る文字列は常にサーバ側の deck 由来になる。
 */
export function parseTarotDraws(value: unknown): Parsed<TarotDraw[]> {
  if (value === undefined || value === null) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: "tarotDraws must be an array of card refs" };
  }
  if (value.length > MAX_TAROT_DRAWS) {
    return {
      ok: false,
      error: `tarotDraws must contain ${MAX_TAROT_DRAWS} cards or fewer`,
    };
  }

  const seen = new Set<number>();
  const draws: TarotDraw[] = [];
  for (const entry of value) {
    if (!isTarotDrawInput(entry)) {
      return { ok: false, error: "tarotDraws entry is malformed" };
    }
    const card = MAJOR_ARCANA.find((c) => c.number === entry.number);
    if (!card) {
      return { ok: false, error: `unknown tarot card: ${entry.number}` };
    }
    if (seen.has(entry.number)) {
      return { ok: false, error: `duplicate tarot card: ${entry.number}` };
    }
    seen.add(entry.number);
    draws.push({ card, isReversed: entry.isReversed });
  }
  return { ok: true, value: draws };
}
