import { NextRequest } from "next/server";
import {
  calculateAllFortunes,
  extractBirthdayInfoFromMessages,
  fortuneResultToPromptContext,
} from "@/lib/fortune-engine";
import { CHAT_SYSTEM_PROMPT } from "@/lib/system-prompt";
import {
  createSession,
  getSession,
  addMessage,
  setFortuneContext,
} from "@/lib/db";
import {
  extractFortuneKeys,
  saveFortuneKeys,
  findSimilarSessions,
  buildRagContext,
  shouldUseRag,
} from "@/lib/session-rag";
import { tarotDrawToPromptContext } from "@/lib/tarot";
import { pickOpeningGreeting } from "@/lib/opening";
import {
  CHAT_DAILY_PER_CLIENT,
  CHAT_RATE_LIMIT,
  MAX_MESSAGES_PER_SESSION,
  clientFingerprint,
  consumeDailyLlmBudget,
  consumeRateLimit,
  tooManyRequests,
} from "@/lib/rate-limit";
import {
  parseOptionalMessage,
  parseSessionId,
  parseTarotDraws,
} from "@/lib/validation";
import { streamClaude } from "@/lib/claude-cli";
import {
  acquireFortuneSession,
  type ModelPiece,
} from "@/lib/claude-session";
import {
  buildFortunePrompt,
  buildFortuneTurnPrompt,
} from "@/lib/fortune-prompt";
import { isDevBridgeEnabled, streamViaDevBridge } from "@/lib/dev-bridge";
import {
  parseSpreadId,
  spreadChoicesForPrompt,
  spreadToPromptContext,
} from "@/lib/tarot-spread";

// node:crypto / DB ドライバ / 子プロセス起動があるので Node ランタイムに固定する
export const runtime = "nodejs";

// system prompt は常にこの定数のみ。占術結果もタロットも会話履歴も stdin 側へ回す
// ため、ユーザー由来の文字列が system prompt に入ることが構造的に起こらない。
const SYSTEM_PROMPT = CHAT_SYSTEM_PROMPT;

/**
 * 送信直後に必ず 1 本流す状態表示。
 *
 * モデルの最初の文字は warm ターンでも 0.8〜1.5 秒、命式込みの本鑑定では 2 秒台
 * かかる (2026-07-28 実測)。無言のまま待たせないために、LLM を待たずに送る。
 */
const WAITING_STATUS = "星を読んでいます…";
/** thinking (本文前の思考) を観測したときの表示。 */
const THINKING_STATUS = "星の並びを読み解いています…";

/** 旧経路 (1 ターン 1 プロセス) に戻す非常口。 */
function isOneShotMode(): boolean {
  return process.env.FORTUNE_CLI_ONESHOT === "1";
}

/** 文字列だけを返す経路 (dev bridge / 旧 CLI) を ModelPiece に揃える。 */
async function* asModelPieces(
  source: AsyncGenerator<string, void, unknown>,
): AsyncGenerator<ModelPiece, void, unknown> {
  for await (const text of source) yield { type: "text", text };
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

/** モデルを介さず、決まったイベント列だけを SSE で返す。 */
function sseOnce(events: unknown[]): Response {
  const body = events
    .map((e) => `data: ${JSON.stringify(e)}\n\n`)
    .join("");
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
    },
  });
}

/** 内部エラーの詳細はクライアントへ返さない (DB URL やスタックの露出防止)。 */
function internalError(context: string, error: unknown): Response {
  console.error(`[chat] ${context}:`, error);
  return Response.json(
    { error: "鑑定の途中で星の巡りが乱れました。少し時間を置いてお試しください。" },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("invalid JSON body");
    }
    const payload = (body ?? {}) as Record<string, unknown>;

    // --- 入力検証 (LLM を呼ぶ前に済ませる。不正リクエストで予算を消費させない) ---
    const sessionIdResult = parseSessionId(payload.sessionId);
    if (!sessionIdResult.ok) return badRequest(sessionIdResult.error);
    const sessionId = sessionIdResult.value;

    const messageResult = parseOptionalMessage(payload.message);
    if (!messageResult.ok) return badRequest(messageResult.error);
    const message = messageResult.value;

    const tarotResult = parseTarotDraws(payload.tarotDraws);
    if (!tarotResult.ok) return badRequest(tarotResult.error);

    // 相談者が選んだ展開法。未選択・不正なら null にして従来表記へ落とす。
    // 3 つの提示はモデルに任せるので、返ってきた id は必ずサーバ側の定義に照合する
    // (存在しない展開法を捏造してくる可能性がある)。
    const spreadId =
      payload.spreadId === undefined
        ? null
        : (parseSpreadId(payload.spreadId).ok
            ? (payload.spreadId as string)
            : null);

    // prompt に載る文字列は必ずサーバ側の deck から組み立てる。
    // 展開法が選ばれていれば位置の意味つき、無ければ従来の「1枚目/2枚目/3枚目」表記。
    const tarotContext =
      tarotResult.value.length === 0
        ? null
        : (spreadId &&
            spreadToPromptContext(
              spreadId,
              tarotResult.value.map((d) => ({
                name: d.card.name,
                reversed: d.isReversed,
              })),
            )) || tarotDrawToPromptContext(tarotResult.value);

    // --- レート制限 ---
    // 窓 (10分) と 1 日の総量を両方見る。窓だけだと 1 IP が自分の許容内で
    // 全体予算を枯らせた (2026-08-07 セキュリティ監査)
    const fingerprint = clientFingerprint(request.headers);
    const perClient = await consumeRateLimit({
      bucket: `chat:${fingerprint}`,
      ...CHAT_RATE_LIMIT,
    });
    if (!perClient.allowed) return tooManyRequests(perClient);

    const perClientDaily = await consumeRateLimit({
      bucket: `chatday:${fingerprint}`,
      ...CHAT_DAILY_PER_CLIENT,
    });
    if (!perClientDaily.allowed) return tooManyRequests(perClientDaily);

    // セッション取得 or 作成
    await createSession(sessionId);
    let session = await getSession(sessionId);
    if (!session) {
      return internalError("session create failed", new Error(sessionId));
    }

    // 1 会話が無限に伸びる (= 毎往復で過去全文を再送する) のを止める
    const userMessageCount = session.messages.filter(
      (m) => m.role === "user",
    ).length;
    if (userMessageCount >= MAX_MESSAGES_PER_SESSION) {
      return Response.json(
        {
          error:
            "この鑑定は充分に深まりました。新しくページを開いて、あらためてお話しください。",
        },
        { status: 429 },
      );
    }

    // 出迎えだけはモデルを呼ばない。相談者の入力に依存しない定型なので
    // 生成する必要が無く、ここで CLI を起動していたせいで「新しい UUID を
    // 投げるだけ」で日次予算を削れた (2026-08-07 セキュリティ監査)。
    // 副産物として初回表示が即時になる。
    if (!message && session.messages.length === 0) {
      const greeting = pickOpeningGreeting();
      await addMessage(sessionId, "assistant", greeting);
      return sseOnce([
        { type: "text", content: greeting },
        { type: "done" },
      ]);
    }

    // ここから先はモデルを呼ぶので、全体の日次予算を消費する
    const dailyBudget = await consumeDailyLlmBudget();
    if (!dailyBudget.allowed) return tooManyRequests(dailyBudget);

    // ユーザーメッセージ追加（初回は空文字でアストレアから開始）
    if (message) {
      await addMessage(sessionId, "user", message);
      session = (await getSession(sessionId))!;
    }

    // 生年月日が含まれていたら占術計算を実行（1回だけ）
    let justDetectedFortune = false;
    if (!session.fortuneContext) {
      const birthdayInfo = extractBirthdayInfoFromMessages(session.messages);
      if (birthdayInfo) {
        const result = calculateAllFortunes(birthdayInfo.parsed, sessionId);
        if (result) {
          // エンジンが独自に引く三枚引きは載せない。相談者が画面で見るのは
          // クライアントが引いた別の 3 枚で、両方渡すと鑑定の根拠が食い違う。
          const context = fortuneResultToPromptContext(result, {
            includeTarot: false,
          });
          await setFortuneContext(sessionId, context);

          // Phase 2: 命式キーを抽出・保存し、成功セッションRAGを検索
          const keys = extractFortuneKeys(context);
          await saveFortuneKeys(sessionId, keys);

          session = (await getSession(sessionId))!;
          justDetectedFortune = true;
        }
      }
    }

    // SSE ストリーミングレスポンス
    const encoder = new TextEncoder();
    const fortuneCtx = session.fortuneContext;
    const currentMessages = [...session.messages];

    // 受け手が消えたら生成を止める。ページ reload / 画面遷移で SSE の相手が
    // 居なくなったのに書き込み続けると "Controller is already closed" で落ち、
    // さらに CLI / bridge が無駄に走り続ける (2026-07-28 実測)。
    const abort = new AbortController();
    let clientGone = false;
    const stopForClient = () => {
      clientGone = true;
      abort.abort();
    };
    request.signal.addEventListener("abort", stopForClient, { once: true });

    /** 受け手が居るときだけ書く。 */
    const send = (payload: unknown, controller: ReadableStreamDefaultController) => {
      if (clientGone) return false;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        return true;
      } catch {
        // 相手が閉じた直後に enqueue が競合した場合
        clientGone = true;
        return false;
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // まず状態表示。ここまでに LLM も DB も待たないので、送信から画面が
          // 動き出すまでの時間はネットワーク往復だけになる
          send({ type: "status", content: WAITING_STATUS }, controller);

          // タロットカード表示イベント送信（占術結果を初検出した直後）
          if (justDetectedFortune) {
            send({ type: "fortuneDetected" }, controller);
          }

          // Phase 2: Epsilon-Greedy で成功セッションを参考に混ぜる
          let ragContext: string | null = null;
          if (fortuneCtx && shouldUseRag()) {
            const keys = extractFortuneKeys(fortuneCtx);
            ragContext = buildRagContext(await findSimilarSessions(keys));
          }

          // 展開法の選択肢は、命式が出た直後（= カードを引く直前）にだけ渡す。
          // 毎ターン載せると文脈を圧迫するうえ、既に選んだ後で選び直しを促してしまう。
          if (justDetectedFortune) {
            ragContext = [ragContext, spreadChoicesForPrompt()]
              .filter(Boolean)
              .join("\n\n");
          }

          // 常駐プロセスが生きている = 会話文脈は CLI 側にある。差分だけ送る。
          // 落ちている / 初回なら全文を送って文脈を作り直す。
          const resident =
            isDevBridgeEnabled() || isOneShotMode()
              ? null
              : acquireFortuneSession(sessionId, SYSTEM_PROMPT);
          const warm = resident?.warm === true;

          const prompt = warm
            ? buildFortuneTurnPrompt({
                // 既に伝えてある命式は送り直さない
                fortuneContext: justDetectedFortune ? fortuneCtx : null,
                ragContext,
                tarotContext,
                message,
              })
            : buildFortunePrompt({
                fortuneContext: fortuneCtx,
                ragContext,
                tarotContext,
                history: currentMessages,
              });

          // FORTUNE_DEV_BRIDGE=1 のときは CLI を起動せず、file 経由で応答を待つ。
          // ローカル CLI の認証が無い環境でも UI からの通し確認ができるようにする。
          let source: AsyncGenerator<ModelPiece, void, unknown>;
          if (isDevBridgeEnabled()) {
            source = asModelPieces(
              streamViaDevBridge({
                sessionId,
                turn: currentMessages.length,
                systemPrompt: SYSTEM_PROMPT,
                prompt,
                signal: abort.signal,
              }),
            );
          } else if (resident) {
            source = resident.sendTurn(prompt, abort.signal);
          } else {
            source = asModelPieces(
              streamClaude({
                systemPrompt: SYSTEM_PROMPT,
                prompt,
                signal: abort.signal,
              }),
            );
          }

          let fullText = "";
          for await (const piece of source) {
            if (clientGone) break;
            if (piece.type === "thinking") {
              // 本文の前に thinking が入ると数秒無言になる。待たせている理由を出す
              send({ type: "status", content: THINKING_STATUS }, controller);
              continue;
            }
            fullText += piece.text;
            send({ type: "text", content: piece.text }, controller);
          }

          // 途中で相手が消えた場合は、半端な返答を履歴に残さない
          if (clientGone) {
            controller.close();
            return;
          }

          // アシスタントメッセージをDBに保存
          await addMessage(sessionId, "assistant", fullText);

          send({ type: "done" }, controller);
          controller.close();
        } catch (error) {
          if (clientGone) {
            // 相手が居ないので通知先も無い。静かに閉じる
            try {
              controller.close();
            } catch {
              /* すでに閉じている */
            }
            return;
          }
          // 詳細はサーバログにだけ残す
          console.error("[chat] stream failed:", error);
          send(
            {
              type: "error",
              content: "星の声が遠のいてしまいました。",
            },
            controller,
          );
          controller.close();
        }
      },
      cancel() {
        // 受け手が購読をやめた (タブを閉じた / reload した)
        stopForClient();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return internalError("request failed", error);
  }
}
