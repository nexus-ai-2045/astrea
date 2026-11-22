// ローカルの Claude Code CLI (`claude -p`) を叩く薄いラッパ。1 ターン 1 プロセス。
//
// なぜ SDK ではなく CLI か: API キーを持たず、手元の Claude サブスクリプションで
// 動かすため (global 規約 S1)。代わりに Vercel など CLI の無い環境では動かない。
//
// 現在の既定経路は claude-session.ts の常駐プロセス (1 ターンごとに立て直すと
// bootstrap の 2.2〜15.3s を毎回払うため)。こちらは FORTUNE_CLI_ONESHOT=1 で
// 戻せる非常口として残す。binary 解決 / env の掃除 / NDJSON 分解は両者で共用する。
//
// 設計上の制約:
//  - Windows の cmd.exe は argv 8191 字上限。system prompt は固定文字列だけを
//    引数で渡し、占術結果・タロット・会話履歴といった動的な部分は stdin に載せる。
//    結果として system prompt にユーザー由来の文字列が一切入らない構造になる。
//  - CLI は agent なので、既定ではツールも個人の hook / MCP も読み込む。占い用途では
//    どれも不要かつ危険なので、明示的に全部落とす。

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/** CLI に渡す固定フラグ。ユーザー入力は 1 つも含まない。 */
const BASE_ARGS = [
  "-p",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  // 個人の hook / skill / CLAUDE.md を読み込ませない (毎回 SessionStart hook が
  // 走ると遅いうえ、占いと無関係な副作用が出る。実測 hook イベント 14 → 0)
  "--setting-sources",
  "",
  // MCP を一切ロードしない
  "--strict-mcp-config",
  // 占い会話を Claude Code の session store に残さない
  "--no-session-persistence",
  // ツール無効。匿名の入力で file 読み取りや bash が動く経路を作らない
  "--allowed-tools",
  "",
];

/**
 * 子プロセスへ渡さない環境変数。
 *
 * Claude Code セッションの中から dev server を起動すると ANTHROPIC_BASE_URL が
 * 継承され、CLI がそちらへ OAuth しに行って
 * "OAuth session expired and could not be refreshed" で失敗する (2026-07-28 実測)。
 * 起動元に関係なく CLI 自身の認証を使わせる。
 */
const STRIPPED_ENV = [
  // harness が注入するプロキシ。継承すると CLI がそちらへ OAuth しに行って失敗する
  "ANTHROPIC_BASE_URL",
  // API キー方式は使わない (S1: LLM 呼び出しは claude -p 経由のみ)
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
];

// CLAUDE_CODE_OAUTH_TOKEN は**剥がさない**。
// これは `claude setup-token` で発行する長期トークンで、このアプリ自身の認証手段。
// セッション認証 (/login) は約1週間で切れる。実際 2026-07-28 にログインしたものが
// 08-04 に失効し、鑑定が「星の声が遠のいて…」で止まった。無人運用にはトークンが要る。
// harness 側がこの変数を注入することは無い (2026-07-28 実測で未設定を確認)。

/**
 * 起動する実行ファイルを決める。
 *
 * Windows の PATH 上にあるのは `claude.ps1` と `claude.cmd` だけで、どちらも
 * Node から直接は起動できない (.cmd は shell 必須)。ただし .cmd の中身は
 * 同階層 node_modules の `claude.exe` を呼んでいるだけなので、その exe を
 * 直接指す。shell を挟まないことで、空文字引数 (`--setting-sources ""`) が
 * 連結時に消えて次のフラグを食う問題も回避できる (2026-07-28 実測)。
 */
export function resolveBinary(): string {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  if (process.platform !== "win32") return "claude";

  const suffix = path.join(
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "bin",
    "claude.exe",
  );
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const direct = path.join(dir, "claude.exe");
    if (existsSync(direct)) return direct;
    if (existsSync(path.join(dir, "claude.cmd"))) {
      const nested = path.join(dir, suffix);
      if (existsSync(nested)) return nested;
    }
  }
  throw new ClaudeCliError(
    "claude.exe が見つかりません。CLAUDE_CLI_PATH で明示してください",
  );
}

export function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of STRIPPED_ENV) delete env[key];
  return env;
}

export class ClaudeCliError extends Error {}

/**
 * `claude -p` を起動し、生成テキストを届いた順に yield する。
 *
 * @param systemPrompt 固定の人格プロンプト。呼び出し側で定数だけを渡すこと
 * @param prompt       stdin へ流す本文 (占術結果・会話履歴・今回の発話)
 */
export async function* streamClaude(options: {
  systemPrompt: string;
  prompt: string;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const child = spawn(
    resolveBinary(),
    [...BASE_ARGS, "--system-prompt", options.systemPrompt],
    {
      env: childEnv(),
      // shell は使わない (resolveBinary が exe を直接指すため)。空文字引数が
      // そのまま渡り、引数の quoting 事故も起きない。
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  options.signal?.addEventListener("abort", () => child.kill(), { once: true });

  child.stdin.end(options.prompt, "utf8");

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const exited = new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? -1));
  });

  let buffer = "";
  let resultError: string | null = null;
  let sawText = false;

  child.stdout.setEncoding("utf8");
  const lines = streamLines(child.stdout);

  for await (const line of lines) {
    buffer = line;
    if (!buffer.startsWith("{")) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(buffer);
    } catch {
      continue; // 途中で切れた行は捨てる (stream-json は 1 行 1 JSON)
    }

    // --include-partial-messages のトークン差分
    if (event.type === "stream_event") {
      const delta = (event.event as Record<string, unknown> | undefined)
        ?.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        sawText = true;
        yield delta.text;
      }
      continue;
    }

    // 差分が来ない環境向けのフォールバック: 完成した assistant メッセージ
    if (event.type === "assistant" && !sawText) {
      const message = event.message as { content?: unknown[] } | undefined;
      for (const block of message?.content ?? []) {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          yield b.text;
        }
      }
      continue;
    }

    if (event.type === "result" && event.is_error) {
      resultError = String(event.result ?? "unknown CLI error");
    }
  }

  const code = await exited;
  if (resultError) {
    throw new ClaudeCliError(resultError);
  }
  if (code !== 0) {
    throw new ClaudeCliError(
      `claude CLI exited with ${code}${stderr ? `: ${stderr.slice(0, 400)}` : ""}`,
    );
  }
}

/** チャンク境界をまたいで届く NDJSON を 1 行ずつに直す。 */
export async function* streamLines(
  source: AsyncIterable<string>,
): AsyncGenerator<string, void, unknown> {
  let pending = "";
  for await (const chunk of source) {
    pending += chunk;
    let index = pending.indexOf("\n");
    while (index !== -1) {
      yield pending.slice(0, index).trim();
      pending = pending.slice(index + 1);
      index = pending.indexOf("\n");
    }
  }
  if (pending.trim()) yield pending.trim();
}
