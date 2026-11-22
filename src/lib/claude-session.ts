// 常駐する `claude -p` プロセスを 1 セッション 1 本で持ち回すラッパ。
//
// なぜ常駐か: CLI の起動コストは exe のロード (0.24〜0.42s) ではなく、その後の
// session bootstrap (認証 / 設定 / skill 探索 / prompt キャッシュ準備) が支配的で、
// 2.2s〜15.3s と machine load で暴れる (2026-07-28 実測 n≈20)。1 往復ごとに
// プロセスを立て直すとこれを毎回払う。`--input-format stream-json` で 1 プロセスに
// 複数ターンを流すと、この費用がセッション初回だけになる。
//   実測: warm ターンの完了 1675〜2239ms (n=6 全件 3 秒以内) / 最初の文字 844〜1575ms
//
// stdin の schema は help に載っていないので実験で確定した (2026-07-28):
//   {"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]},
//    "parent_tool_use_id":null,"session_id":"<uuid>"}
// 1 行 1 JSON。session_id は初回はダミー UUID でよく、CLI が返した実 id 以降は
// そちらを使う。
//
// 落とし穴 (すべて実測):
//  1. 最初の user message を書くまで CLI は system/init すら出さない。init を
//     待ってから送る実装は 120 秒無出力でデッドロックした。spawn 直後に即書く。
//  2. ターン境界は type="result"。これを受けてから次の user message を書く。
//  3. `--no-session-persistence` を付けると stdin を閉じて 537ms で exitCode 0。
//     外すと stdin を閉じてもプロセスが残る (孤児プロセスの原因)。必ず維持する。
//  4. 中断は kill 不要。control_request の interrupt を 1 行書けば 32ms で止まる。
//
// 会話文脈は同一プロセス内に残るので、毎ターン履歴と命式を再送しない
// (再送すると turn2 の最初の文字が 1202ms → 2433ms に劣化した実測)。
// 差分だけを送る本文の組み立ては fortune-prompt.ts の buildFortuneTurnPrompt。

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  ClaudeCliError,
  childEnv,
  resolveBinary,
  streamLines,
} from "./claude-cli";

/** 常駐プロセスに渡す固定フラグ。ユーザー入力は 1 つも含まない。 */
export const SESSION_ARGS = [
  "-p",
  // realtime streaming input。これが常駐の本体
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  // 個人の hook / skill / CLAUDE.md を読み込ませない
  "--setting-sources",
  "",
  // MCP を一切ロードしない
  "--strict-mcp-config",
  // 占い会話を Claude Code の session store に残さない (落とし穴 3 も参照)
  "--no-session-persistence",
  // skill 16 件の探索を止める。init が一貫して最速だった (2310〜3976ms)
  "--disable-slash-commands",
  // ツールは「許可しない」ではなく「定義ごと落とす」。--allowed-tools "" だと
  // 定義 32 件 / 22686 tokens が prefill に残り init→message_start が
  // 2114ms かかる。--tools "" では 947ms
  "--tools",
  "",
  // 既定は opus-5。warm ターンの最初の文字が sonnet 0.8〜2.2s / opus 2.9〜3.2s
  "--model",
  "sonnet",
  // 4 見出しの本鑑定では本文の前に extended thinking が入り最初の文字が 5881ms。
  // low で thinking_delta 6→1 件、2640ms
  "--effort",
  "low",
];

/** 常駐プロセスが吐く 1 単位。thinking は「読んでいる」表示用で本文ではない。 */
export type ModelPiece =
  | { type: "text"; text: string }
  | { type: "thinking" };

/**
 * 子プロセスの最小面。テストでは偽物を差して claude.exe を起動せずに検証する。
 */
export interface ClaudeTransport {
  /** NDJSON 1 行 (改行込み) を stdin へ書く */
  write(line: string): void;
  /** stdout から届く次の 1 行。プロセスが閉じたら null */
  nextLine(): Promise<string | null>;
  /** stdin を閉じてプロセスを終わらせる */
  close(): void;
  /** エラー文に添える診断 (stderr 末尾など) */
  diagnostics?(): string;
}

export interface ClaudeSessionOptions {
  /** 固定の人格プロンプト。呼び出し側で定数だけを渡すこと */
  systemPrompt: string;
  /** 差し替え用。既定は claude.exe を spawn する */
  createTransport?: () => ClaudeTransport;
}

/** abort を「行の到着」と区別するための番兵。 */
const ABORTED = Symbol("aborted");

/** 1 セッション = 1 常駐プロセス。ターンは直列にしか流せない。 */
export class ClaudeSession {
  private transport: ClaudeTransport | null = null;
  /** CLI が採番する session_id。初回はダミーで良い */
  private cliSessionId: string = randomUUID();
  private busy = false;
  private idleSince: number;

  constructor(private readonly options: ClaudeSessionOptions) {
    this.idleSince = Date.now();
  }

  /** プロセスが起動済み (= 会話文脈を持っている) か。 */
  get warm(): boolean {
    return this.transport !== null;
  }

  /** 回収判定用。最後に使われた時刻。 */
  get lastUsedAt(): number {
    return this.idleSince;
  }

  touch(now: number = Date.now()): void {
    this.idleSince = now;
  }

  /**
   * 1 ターン流して届いた順に yield する。`result` イベントで終わる。
   *
   * @param prompt 常駐プロセスへ送る本文。warm なら差分だけで足りる
   */
  async *sendTurn(
    prompt: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ModelPiece, void, unknown> {
    if (this.busy) {
      throw new ClaudeCliError(
        "同じセッションで 2 つのターンを同時に流すことはできません",
      );
    }
    this.busy = true;
    try {
      yield* this.runTurn(prompt, signal);
    } finally {
      this.busy = false;
      this.touch();
    }
  }

  /** stdin を閉じてプロセスを畳む。次ターンは新しいプロセスになる。 */
  dispose(): void {
    const transport = this.transport;
    this.transport = null;
    // 文脈が消えるので session_id も引き継がない
    this.cliSessionId = randomUUID();
    if (!transport) return;
    try {
      transport.close();
    } catch {
      // すでに死んでいる
    }
  }

  private async *runTurn(
    prompt: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ModelPiece, void, unknown> {
    // 受け手がもう居ないなら起こす意味がない
    if (signal?.aborted) return;

    const transport = this.ensureTransport();
    // 落とし穴 1: init を待たずに即書く
    this.writeUserMessage(transport, prompt);

    const aborted = new Promise<typeof ABORTED>((resolve) => {
      signal?.addEventListener("abort", () => resolve(ABORTED), { once: true });
    });

    let sawText = false;
    let resultError: string | null = null;

    while (true) {
      const next = await Promise.race([transport.nextLine(), aborted]);

      if (next === ABORTED) {
        // 落とし穴 4: kill ではなく interrupt。そのうえで文脈が DB と食い違う
        // ので畳む (中断分は DB に保存しないため)
        this.requestInterrupt(transport);
        this.dispose();
        return;
      }
      if (next === null) {
        const detail = transport.diagnostics?.() ?? "";
        this.dispose();
        throw new ClaudeCliError(
          `claude CLI が応答途中で終了しました${detail ? `: ${detail.slice(0, 400)}` : ""}`,
        );
      }
      if (!next.startsWith("{")) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(next) as Record<string, unknown>;
      } catch {
        continue; // 途中で切れた行は捨てる (stream-json は 1 行 1 JSON)
      }

      if (typeof event.session_id === "string" && event.session_id) {
        this.cliSessionId = event.session_id;
      }

      if (event.type === "stream_event") {
        const delta = (event.event as Record<string, unknown> | undefined)
          ?.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          sawText = true;
          yield { type: "text", text: delta.text };
        } else if (delta?.type === "thinking_delta") {
          // 本文の前に thinking が入ると無言時間になる。表示側で埋める材料にする
          yield { type: "thinking" };
        }
        continue;
      }

      // 差分が来ない環境向けのフォールバック: 完成した assistant メッセージ
      if (event.type === "assistant" && !sawText) {
        const message = event.message as { content?: unknown[] } | undefined;
        for (const block of message?.content ?? []) {
          const b = block as Record<string, unknown>;
          if (b.type === "text" && typeof b.text === "string") {
            yield { type: "text", text: b.text };
          }
        }
        continue;
      }

      // 落とし穴 2: ターン境界
      if (event.type === "result") {
        if (event.is_error) {
          resultError = String(event.result ?? "unknown CLI error");
        }
        break;
      }
    }

    if (resultError) {
      this.dispose();
      throw new ClaudeCliError(resultError);
    }
  }

  private ensureTransport(): ClaudeTransport {
    if (this.transport) return this.transport;
    const create =
      this.options.createTransport ??
      (() => createChildTransport(this.options.systemPrompt));
    this.transport = create();
    return this.transport;
  }

  private writeUserMessage(transport: ClaudeTransport, text: string): void {
    const line =
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text }] },
        parent_tool_use_id: null,
        session_id: this.cliSessionId,
      }) + "\n";
    try {
      transport.write(line);
    } catch (error) {
      this.dispose();
      throw new ClaudeCliError(
        `claude CLI へ書き込めませんでした: ${String(error)}`,
      );
    }
  }

  private requestInterrupt(transport: ClaudeTransport): void {
    try {
      transport.write(
        JSON.stringify({
          type: "control_request",
          request_id: randomUUID(),
          request: { subtype: "interrupt" },
        }) + "\n",
      );
    } catch {
      // すでに死んでいる。dispose 側で畳む
    }
  }
}

/** stdin を閉じてもプロセスが残った場合の保険。 */
const KILL_GRACE_MS = 3000;

function createChildTransport(systemPrompt: string): ClaudeTransport {
  const child = spawn(
    resolveBinary(),
    [...SESSION_ARGS, "--system-prompt", systemPrompt],
    {
      env: childEnv(),
      // shell は使わない。空文字引数 (`--tools ""`) がそのまま渡る
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-2000);
  });
  // stdin が死んだ後の write で unhandled error にならないようにする
  child.stdin.on("error", () => {});
  child.on("error", (error) => {
    stderr = `${stderr}\n${error.message}`.slice(-2000);
  });

  child.stdout.setEncoding("utf8");
  const iterator = streamLines(child.stdout)[Symbol.asyncIterator]();

  return {
    write(line: string) {
      child.stdin.write(line, "utf8");
    },
    async nextLine() {
      const { done, value } = await iterator.next();
      return done ? null : value;
    },
    close() {
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), KILL_GRACE_MS);
      timer.unref?.();
      child.once("close", () => clearTimeout(timer));
    },
    diagnostics() {
      return stderr.trim();
    },
  };
}

// --- 常駐プロセスの台帳 -----------------------------------------------------
//
// sessionId → 常駐プロセス。放置されたものは回収し、同時本数に上限を置く。
// 上限は「認証なしの公開エンドポイントで claude.exe が無限に増えない」ための
// 財布と CPU の防衛線 (rate-limit.ts と同じ趣旨)。

/** 何も来なくなってから畳むまで。 */
export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
/** 同時に持つ常駐プロセスの上限。超えたら最も古いものから畳む。 */
export const MAX_RESIDENT_SESSIONS = 6;
/**
 * 放置セッションの見回り間隔。
 *
 * リクエスト到着時にも回収するが、それだけだと「最後の 1 往復のあと誰も来ない」
 * 場合に claude.exe が居座る。孤児プロセスは体感を直接壊す (2026-07-28 に別件の
 * 常駐プロセスを 1 本畳んでファイル書込が 34ms → 0.93ms) ので時間でも回収する。
 */
export const SESSION_REAP_INTERVAL_MS = 60 * 1000;

/** dev の hot reload でモジュールが作り直されても台帳を失わない。 */
const store = globalThis as typeof globalThis & {
  __fortuneClaudeSessions?: Map<string, ClaudeSession>;
  __fortuneClaudeExitHook?: boolean;
  __fortuneClaudeReaper?: ReturnType<typeof setInterval>;
};
const pool: Map<string, ClaudeSession> = (store.__fortuneClaudeSessions ??=
  new Map());

function installExitHook(): void {
  if (store.__fortuneClaudeExitHook) return;
  store.__fortuneClaudeExitHook = true;
  // 親が落ちたら stdin が閉じて CLI も終わるが、通常終了では明示的に畳む
  process.once("exit", () => disposeAllFortuneSessions());
}

/** 見回りを止める (graceful shutdown / テストの後片付け)。 */
export function stopFortuneSessionReaper(): void {
  const timer = store.__fortuneClaudeReaper;
  if (!timer) return;
  clearInterval(timer);
  store.__fortuneClaudeReaper = undefined;
}

/** 放置セッションを時間で回収する見回りを 1 本だけ立てる。 */
export function startFortuneSessionReaper(): void {
  if (store.__fortuneClaudeReaper) return;
  const timer = setInterval(
    () => reapIdleFortuneSessions(),
    SESSION_REAP_INTERVAL_MS,
  );
  // server の終了を妨げない
  timer.unref?.();
  store.__fortuneClaudeReaper = timer;
}

/** sessionId に紐づく常駐プロセスを取り出す (無ければ作る)。 */
export function acquireFortuneSession(
  sessionId: string,
  systemPrompt: string,
  options: { now?: number } = {},
): ClaudeSession {
  const now = options.now ?? Date.now();
  installExitHook();
  startFortuneSessionReaper();
  reapIdleFortuneSessions(now);

  let session = pool.get(sessionId);
  if (!session) {
    while (pool.size >= MAX_RESIDENT_SESSIONS) evictOldest();
    session = new ClaudeSession({ systemPrompt });
    pool.set(sessionId, session);
  }
  session.touch(now);
  return session;
}

/** 常駐プロセスを持っているか (= 会話文脈が残っているか)。 */
export function hasFortuneSession(sessionId: string): boolean {
  return pool.get(sessionId)?.warm === true;
}

export function disposeFortuneSession(sessionId: string): void {
  const session = pool.get(sessionId);
  pool.delete(sessionId);
  session?.dispose();
}

export function fortuneSessionCount(): number {
  return pool.size;
}

export function reapIdleFortuneSessions(now: number = Date.now()): void {
  for (const [id, session] of pool) {
    if (now - session.lastUsedAt >= SESSION_IDLE_TIMEOUT_MS) {
      pool.delete(id);
      session.dispose();
    }
  }
}

export function disposeAllFortuneSessions(): void {
  for (const [id, session] of pool) {
    pool.delete(id);
    session.dispose();
  }
}

function evictOldest(): void {
  let oldestId: string | null = null;
  let oldest = Infinity;
  for (const [id, session] of pool) {
    if (session.lastUsedAt < oldest) {
      oldest = session.lastUsedAt;
      oldestId = id;
    }
  }
  if (oldestId !== null) disposeFortuneSession(oldestId);
}
