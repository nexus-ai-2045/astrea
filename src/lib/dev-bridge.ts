// 開発用の file-backed モデル bridge。
//
// `claude -p` はローカル CLI の認証が要る。認証が無い環境でも UI・タロット・
// ストリーミング・DB 保存までを通しで確認できるように、プロンプトをファイルへ
// 書き出して応答ファイルを待つ経路を用意する。応答は人間か、別に起動している
// Claude セッションが書く。
//
// 既定は無効。FORTUNE_DEV_BRIDGE=1 のときだけ有効になる。本番経路は変えない。

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BRIDGE_DIR_NAME = ".dev-bridge";

/** 応答を待つ上限。超えたら諦めてエラーにする。 */
const WAIT_TIMEOUT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 500;
// 応答を一気に出さず、ストリーミングらしく刻む。
// 旧値 (24 文字 / 40ms) は 400 字の鑑定文で表示だけに 0.7 秒かかっていたので詰めた。
const CHUNK_CHARS = 12;
const CHUNK_DELAY_MS = 12;

export function isDevBridgeEnabled(): boolean {
  return process.env.FORTUNE_DEV_BRIDGE === "1";
}

export function bridgeDir(): string {
  return path.join(process.cwd(), BRIDGE_DIR_NAME);
}

function stamp(sessionId: string, turn: number): string {
  // sessionId は UUID 検証済みなので path 要素として安全
  return `${sessionId}.${String(turn).padStart(3, "0")}`;
}

/**
 * プロンプトを request ファイルへ書き、対応する response ファイルの出現を待つ。
 * 現れたら少しずつ yield してストリーミングに見せる。
 */
export async function* streamViaDevBridge(options: {
  sessionId: string;
  turn: number;
  systemPrompt: string;
  prompt: string;
  signal?: AbortSignal;
  now?: () => number;
}): AsyncGenerator<string, void, unknown> {
  const dir = bridgeDir();
  await mkdir(dir, { recursive: true });

  const base = stamp(options.sessionId, options.turn);
  const requestPath = path.join(dir, `${base}.request.md`);
  const responsePath = path.join(dir, `${base}.response.md`);

  await writeFile(
    requestPath,
    [
      "<!-- FORTUNE_DEV_BRIDGE -->",
      "<!-- この request に対する応答を同ディレクトリの",
      `     ${base}.response.md へ書くと、アプリがそれを配信します -->`,
      "",
      "## SYSTEM",
      "",
      options.systemPrompt,
      "",
      "## PROMPT",
      "",
      options.prompt,
      "",
    ].join("\n"),
    "utf8",
  );

  const clock = options.now ?? (() => Date.now());
  const deadline = clock() + WAIT_TIMEOUT_MS;
  let body: string | null = null;

  while (clock() < deadline) {
    // 受け手が消えたら待つ意味がない
    if (options.signal?.aborted) return;
    try {
      const text = await readFile(responsePath, "utf8");
      if (text.trim().length > 0) {
        body = text.trim();
        break;
      }
    } catch {
      // まだ無い
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (body === null) {
    if (options.signal?.aborted) return;
    throw new Error(`dev bridge timed out waiting for ${base}.response.md`);
  }

  for (let i = 0; i < body.length; i += CHUNK_CHARS) {
    if (options.signal?.aborted) return;
    yield body.slice(i, i + CHUNK_CHARS);
    await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
  }
}

/** 待機中の request を列挙する (応答を書く側が使う)。 */
export async function pendingRequests(): Promise<string[]> {
  const dir = bridgeDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const responses = new Set(
    entries
      .filter((f) => f.endsWith(".response.md"))
      .map((f) => f.replace(/\.response\.md$/, "")),
  );
  return entries
    .filter((f) => f.endsWith(".request.md"))
    .map((f) => f.replace(/\.request\.md$/, ""))
    .filter((base) => !responses.has(base))
    .sort();
}
