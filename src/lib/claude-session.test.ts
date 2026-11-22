import { describe, expect, test, vi } from "vitest";
import {
  ClaudeSession,
  SESSION_ARGS,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_REAP_INTERVAL_MS,
  acquireFortuneSession,
  disposeFortuneSession,
  fortuneSessionCount,
  reapIdleFortuneSessions,
  stopFortuneSessionReaper,
  type ClaudeTransport,
  type ModelPiece,
} from "./claude-session";
import { ClaudeCliError } from "./claude-cli";

/**
 * 子プロセスの代わり。書かれた行を記録し、こちらから任意のイベントを流せる。
 * 実際の claude.exe を起動しないので、ここでの検証は数ミリ秒で終わる。
 */
class FakeTransport implements ClaudeTransport {
  written: string[] = [];
  closed = false;
  private queue: string[] = [];
  private waiters: ((line: string | null) => void)[] = [];
  private ended = false;

  write(line: string): void {
    this.written.push(line);
  }

  nextLine(): Promise<string | null> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    if (this.ended) return Promise.resolve(null);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  close(): void {
    this.closed = true;
    this.end();
  }

  /** CLI が 1 行 NDJSON を吐いたことにする。 */
  emit(event: unknown): void {
    const line = JSON.stringify(event);
    const waiter = this.waiters.shift();
    if (waiter) waiter(line);
    else this.queue.push(line);
  }

  /** stdout が閉じた (プロセスが死んだ) ことにする。 */
  end(): void {
    this.ended = true;
    for (const waiter of this.waiters.splice(0)) waiter(null);
  }

  /** 書かれた行を JSON として読む。 */
  parsed(): Record<string, unknown>[] {
    return this.written.map((l) => JSON.parse(l) as Record<string, unknown>);
  }
}

function textDelta(text: string) {
  return {
    type: "stream_event",
    event: { type: "content_block_delta", delta: { type: "text_delta", text } },
  };
}

function thinkingDelta(text: string) {
  return {
    type: "stream_event",
    event: {
      type: "content_block_delta",
      delta: { type: "thinking_delta", thinking: text },
    },
  };
}

function result(extra: Record<string, unknown> = {}) {
  return { type: "result", subtype: "success", is_error: false, ...extra };
}

function makeSession(transport: FakeTransport) {
  return new ClaudeSession({
    systemPrompt: "SYS",
    createTransport: () => transport,
  });
}

async function collect(
  source: AsyncGenerator<ModelPiece, void, unknown>,
): Promise<ModelPiece[]> {
  const pieces: ModelPiece[] = [];
  for await (const piece of source) pieces.push(piece);
  return pieces;
}

describe("SESSION_ARGS", () => {
  test("常駐に必要なフラグが揃っている", () => {
    const joined = SESSION_ARGS.join(" ");
    expect(joined).toContain("--input-format stream-json");
    expect(joined).toContain("--output-format stream-json");
    expect(joined).toContain("--include-partial-messages");
    expect(SESSION_ARGS).toContain("-p");
    expect(SESSION_ARGS).toContain("--verbose");
  });

  test("ツールは定義ごと落とす (--allowed-tools ではなく --tools)", () => {
    // --allowed-tools はツール定義 32 件 / 22686 tokens を prefill に載せたまま
    // 許可だけ外す。init→message_start が 2114ms → 947ms になった実測に従う。
    expect(SESSION_ARGS).toContain("--tools");
    expect(SESSION_ARGS).not.toContain("--allowed-tools");
    expect(SESSION_ARGS[SESSION_ARGS.indexOf("--tools") + 1]).toBe("");
  });

  test("体感に効くフラグを明示する", () => {
    const joined = SESSION_ARGS.join(" ");
    // 既定は opus-5。warm ターンの firstText が sonnet 0.8〜2.2s / opus 2.9〜3.2s
    expect(joined).toContain("--model sonnet");
    // 本鑑定で extended thinking が text の前に入り firstText 5.9s → 2.6s
    expect(joined).toContain("--effort low");
    // skill 16 件の探索を止める
    expect(SESSION_ARGS).toContain("--disable-slash-commands");
  });

  test("占い会話を Claude Code の session store に残さない", () => {
    // 外すと stdin を閉じてもプロセスが残る (孤児プロセスの原因)
    expect(SESSION_ARGS).toContain("--no-session-persistence");
    expect(SESSION_ARGS).toContain("--strict-mcp-config");
    expect(SESSION_ARGS).toContain("--setting-sources");
  });

  test("system prompt は呼び出し側が足す (固定文字列のみ)", () => {
    expect(SESSION_ARGS).not.toContain("--system-prompt");
  });
});

describe("ClaudeSession", () => {
  test("1 ターン目の発話を stream-json の user message として書く", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit({ type: "system", subtype: "init", session_id: "s-1" });
    transport.emit(textDelta("こん"));
    transport.emit(textDelta("にちは"));
    transport.emit(result());

    const pieces = await collect(session.sendTurn("占って"));

    expect(pieces).toEqual([
      { type: "text", text: "こん" },
      { type: "text", text: "にちは" },
    ]);
    const sent = transport.parsed();
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("user");
    expect(sent[0].parent_tool_use_id).toBeNull();
    expect(sent[0].message).toEqual({
      role: "user",
      content: [{ type: "text", text: "占って" }],
    });
    expect(typeof sent[0].session_id).toBe("string");
  });

  test("1 行ごとに改行を付けて書く (NDJSON)", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);
    transport.emit(result());
    await collect(session.sendTurn("はい"));
    expect(transport.written[0].endsWith("\n")).toBe(true);
    expect(transport.written[0].trimEnd()).not.toContain("\n");
  });

  test("2 ターン目はプロセスを立て直さない", async () => {
    const transport = new FakeTransport();
    const createTransport = vi.fn(() => transport);
    const session = new ClaudeSession({
      systemPrompt: "SYS",
      createTransport,
    });

    transport.emit({ type: "system", subtype: "init", session_id: "s-9" });
    transport.emit(textDelta("1"));
    transport.emit(result());
    await collect(session.sendTurn("turn1"));

    transport.emit(textDelta("2"));
    transport.emit(result());
    const second = await collect(session.sendTurn("turn2"));

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(second).toEqual([{ type: "text", text: "2" }]);
  });

  test("CLI が返した session_id を 2 ターン目以降に使う", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit({ type: "system", subtype: "init", session_id: "real-id" });
    transport.emit(result());
    await collect(session.sendTurn("turn1"));

    transport.emit(result());
    await collect(session.sendTurn("turn2"));

    expect(transport.parsed()[1].session_id).toBe("real-id");
  });

  test("thinking の差分は本文ではなく thinking として渡す", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit(thinkingDelta("考え中"));
    transport.emit(textDelta("お待たせしました"));
    transport.emit(result());

    const pieces = await collect(session.sendTurn("占って"));
    expect(pieces).toEqual([
      { type: "thinking" },
      { type: "text", text: "お待たせしました" },
    ]);
  });

  test("差分が来ない環境では完成メッセージを使う", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit({
      type: "assistant",
      message: { content: [{ type: "text", text: "全文" }] },
    });
    transport.emit(result());

    expect(await collect(session.sendTurn("占って"))).toEqual([
      { type: "text", text: "全文" },
    ]);
  });

  test("差分が来たら完成メッセージは二重に出さない", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit(textDelta("差分"));
    transport.emit({
      type: "assistant",
      message: { content: [{ type: "text", text: "差分" }] },
    });
    transport.emit(result());

    expect(await collect(session.sendTurn("占って"))).toEqual([
      { type: "text", text: "差分" },
    ]);
  });

  test("result でターンが閉じ、次の行は読まない", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit(textDelta("A"));
    transport.emit(result());
    transport.emit(textDelta("次ターンの分"));

    expect(await collect(session.sendTurn("turn1"))).toEqual([
      { type: "text", text: "A" },
    ]);

    transport.emit(result());
    expect(await collect(session.sendTurn("turn2"))).toEqual([
      { type: "text", text: "次ターンの分" },
    ]);
  });

  test("JSON でない行は無視する", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.write; // 型の都合で参照だけ
    transport.emit(textDelta("A"));
    transport.emit(result());

    expect(await collect(session.sendTurn("x"))).toEqual([
      { type: "text", text: "A" },
    ]);
  });

  test("result が is_error なら ClaudeCliError を投げ、プロセスを畳む", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit(result({ is_error: true, result: "boom", subtype: "error" }));

    await expect(collect(session.sendTurn("x"))).rejects.toThrow(ClaudeCliError);
    expect(transport.closed).toBe(true);
    expect(session.warm).toBe(false);
  });

  test("プロセスが途中で死んだら ClaudeCliError", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    transport.emit(textDelta("途中"));
    transport.end();

    await expect(collect(session.sendTurn("x"))).rejects.toThrow(ClaudeCliError);
    expect(session.warm).toBe(false);
  });

  test("abort は kill ではなく interrupt 要求で止める", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);
    const abort = new AbortController();

    const pieces: ModelPiece[] = [];
    const run = (async () => {
      for await (const piece of session.sendTurn("x", abort.signal)) {
        pieces.push(piece);
        if (pieces.length === 1) abort.abort();
      }
    })();

    transport.emit(textDelta("途中まで"));
    await run;

    const sent = transport.parsed();
    expect(sent[1].type).toBe("control_request");
    expect(sent[1].request).toEqual({ subtype: "interrupt" });
    expect(typeof sent[1].request_id).toBe("string");
    // 中断は例外にしない。半端に出た分だけで静かに終わる
    expect(pieces).toEqual([{ type: "text", text: "途中まで" }]);
  });

  test("中断したターンは常駐プロセスごと畳む", async () => {
    // 中断すると CLI 側の文脈に半端な assistant ターンが残る。DB には保存しない
    // ので、そのまま使い続けると 2 つの履歴が食い違う。次ターンは作り直す。
    const transport = new FakeTransport();
    const session = makeSession(transport);
    const abort = new AbortController();

    const run = (async () => {
      for await (const _ of session.sendTurn("x", abort.signal)) abort.abort();
    })();
    transport.emit(textDelta("途中まで"));
    await run;

    expect(transport.closed).toBe(true);
    expect(session.warm).toBe(false);
  });

  test("開始前に abort されていたらプロセスを起こさない", async () => {
    const transport = new FakeTransport();
    const createTransport = vi.fn(() => transport);
    const session = new ClaudeSession({
      systemPrompt: "SYS",
      createTransport,
    });
    const abort = new AbortController();
    abort.abort();

    expect(await collect(session.sendTurn("x", abort.signal))).toEqual([]);
    expect(createTransport).not.toHaveBeenCalled();
  });

  test("dispose で stdin を閉じる", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);
    transport.emit(result());
    await collect(session.sendTurn("x"));

    session.dispose();
    expect(transport.closed).toBe(true);
    expect(session.warm).toBe(false);
  });

  test("同時に 2 ターンを走らせない", async () => {
    const transport = new FakeTransport();
    const session = makeSession(transport);

    const first = collect(session.sendTurn("turn1"));
    await expect(collect(session.sendTurn("turn2"))).rejects.toThrow(
      ClaudeCliError,
    );
    transport.emit(result());
    await first;
  });
});

describe("常駐プロセスの台帳", () => {
  test("同じ sessionId は同じ常駐プロセスを使う", () => {
    const id = "pool-a";
    try {
      const a = acquireFortuneSession(id, "SYS");
      const b = acquireFortuneSession(id, "SYS");
      expect(b).toBe(a);
      expect(fortuneSessionCount()).toBeGreaterThanOrEqual(1);
    } finally {
      disposeFortuneSession(id);
    }
  });

  test("dispose で台帳から消える", () => {
    acquireFortuneSession("pool-b", "SYS");
    disposeFortuneSession("pool-b");
    const after = acquireFortuneSession("pool-b", "SYS");
    disposeFortuneSession("pool-b");
    expect(after.warm).toBe(false);
  });

  test("放置されたセッションは回収される", () => {
    const id = "pool-c";
    acquireFortuneSession(id, "SYS", { now: 0 });
    expect(fortuneSessionCount()).toBeGreaterThanOrEqual(1);
    reapIdleFortuneSessions(60 * 60 * 1000);
    expect(fortuneSessionCount()).toBe(0);
  });

  test("次のリクエストが来なくても時間で回収する", () => {
    // リクエスト契機だけだと「最後の 1 往復のあと誰も来ない」時に居座る
    vi.useFakeTimers();
    try {
      // 先の test が実タイマーで立てた見回りを外し、偽タイマーで立て直させる
      stopFortuneSessionReaper();
      vi.setSystemTime(0);
      acquireFortuneSession("pool-d", "SYS");
      expect(fortuneSessionCount()).toBe(1);
      vi.setSystemTime(SESSION_IDLE_TIMEOUT_MS + 1);
      vi.advanceTimersByTime(SESSION_REAP_INTERVAL_MS);
      expect(fortuneSessionCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
