"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type RefObject,
} from "react";
import TarotSpread from "@/components/TarotSpread";
import SpreadChooser from "@/components/SpreadChooser";
import {
  drawCards,
  type TarotDraw,
} from "@/lib/tarot";
import { SPREADS, findSpread } from "@/lib/tarot-spread";
import { sendScore } from "@/lib/send-score";

type Message = {
  role: "user" | "assistant";
  content: string;
};

/**
 * 送信直後に出す待ち状態。
 *
 * サーバも同じ文言を SSE の status フレームで送ってくるが、こちらはネットワークを
 * 待たずに描画するためのローカル初期値。モデルの最初の文字は warm ターンで
 * 0.8〜1.5 秒かかる (2026-07-28 実測) ので、その間を無言にしない。
 */
const WAITING_STATUS = "星を読んでいます…";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [tarotDraws, setTarotDraws] = useState<TarotDraw[] | null>(null);
  const [showTarot, setShowTarot] = useState(false);
  // 相談者が選んだ展開法。選ぶまでは札を出さない (位置の意味が決まらないため)
  const [spreadId, setSpreadId] = useState<string | null>(null);
  const [tarotRevealed, setTarotRevealed] = useState(false);
  const showTarotRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ページ離脱時にスコアを保存（ボタンを押さずに閉じた場合のフォールバック）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (started && !ended && messages.length >= 4) {
        sendScore(sessionId);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [started, ended, messages.length, sessionId]);

  const sendMessage = useCallback(
    async (
      userMessage: string | null,
      drawsToSend?: TarotDraw[],
      // state ではなく引数で受ける。選択の直後に送るので closure が古い値を
      // 掴むリスクを最初から作らない
      spreadIdToSend?: string | null,
    ) => {
      if (isStreaming) return;
      setIsStreaming(true);
      // fetch より先に置く。ここまでに await が 1 つも無いので、送信操作と同じ
      // フレームで画面が変わる (完了条件 1-c)
      setStatus(WAITING_STATUS);

      // ユーザーメッセージ追加（初回挨拶以外、タロットコンテキスト送信時は非表示）
      if (userMessage) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: userMessage },
        ]);
      }

      // アシスタントの空メッセージを追加（ストリーミング用）
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/fortune/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: userMessage || "",
            // prompt 文字列ではなくカード番号だけを送る。解釈文はサーバ側の
            // deck から組み立てられる (system prompt 注入経路を作らないため)。
            ...(drawsToSend && {
              tarotDraws: drawsToSend.map((d) => ({
                number: d.card.number,
                isReversed: d.isReversed,
              })),
            }),
            // 展開法 id。サーバ側で SPREADS に照合され、不正なら位置の意味なしの
            // 従来表記へ落ちる (鑑定自体は止めない)
            ...(spreadIdToSend && { spreadId: spreadIdToSend }),
          }),
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = JSON.parse(line.slice(6));

            if (data.type === "status") {
              // 「読んでいます」→「読み解いています」など、待たせている理由の更新
              setStatus(data.content);
            } else if (data.type === "text") {
              // 本文が来たら状態表示は役目を終える
              setStatus(null);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + data.content,
                  };
                }
                return updated;
              });
            } else if (data.type === "fortuneDetected") {
              // タロットカードをクライアント側で生成
              const draws = drawCards(3);
              setTarotDraws(draws);
              // 展開法は毎回選び直す。いまは route 側の `if (!session.fortuneContext)`
              // により 1 セッション 1 回しか来ないが、その前提が変わったときに
              // 「前回選んだ展開法のまま新しい札が出る」事故になるので、
              // ここでリセットして層をまたぐ暗黙の依存を切る
              setSpreadId(null);
              showTarotRef.current = true;
              setShowTarot(true);
            } else if (data.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content:
                    "星の声が一時的に遠くなっているようです…少し間を置いて、もう一度お話しかけてみてください。",
                };
                return updated;
              });
            }
          }
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "星との繋がりが途切れてしまいました…もう一度お試しください。",
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
        setStatus(null);
        if (!showTarotRef.current) {
          const el = inputRef.current;
          if (el) {
            el.classList.remove("input-ready");
            void el.offsetWidth;
            el.classList.add("input-ready");
            el.addEventListener(
              "animationend",
              () => el.classList.remove("input-ready"),
              { once: true },
            );
            el.focus();
          }
        }
      }
    },
    [isStreaming, sessionId],
  );

  // 相談者がめくった順で受け取る。1枚目/2枚目/3枚目 は「選んだ順」であり、
  // その順のまま鑑定へ送る (どれを選ぶかに意味を持たせるため)。
  const handleTarotComplete = useCallback(
    (orderedDraws: TarotDraw[]) => {
      showTarotRef.current = false;
      setShowTarot(false);
      setTarotRevealed(true);
      if (orderedDraws.length > 0) {
        setTarotDraws(orderedDraws);
        sendMessage(null, orderedDraws, spreadId);
      }
    },
    [sendMessage, spreadId],
  );

  // 展開法が決まってはじめて札を出す。ここでは送信しない (札をめくる前なので
  // 鑑定に渡すものが揃っていない)
  const handleSpreadSelect = useCallback((selected: string) => {
    setSpreadId(selected);
  }, []);

  const handleStart = useCallback(() => {
    setStarted(true);
    sendMessage(null);
  }, [sendMessage]);

  const flashInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.classList.remove("input-flash");
    void el.offsetWidth;
    el.classList.add("input-flash");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const msg = input.trim();
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    flashInput();
    sendMessage(msg);
  };

  const userMessageCount = messages.filter((m) => m.role === "user").length;

  // 自動終了検知: アストレアが締めの言葉を言ったら自動でセッション終了
  const lastAssistantMsg =
    [...messages].reverse().find((m) => m.role === "assistant")?.content || "";
  const sessionEndKeywords = [
    "良い旅路を",
    "またお越しください",
    "お越しくださいませ",
    "星はいつでも",
    "本日の鑑定",
  ];
  const shouldAutoEnd =
    !ended &&
    !isStreaming &&
    userMessageCount >= 3 &&
    sessionEndKeywords.some((kw) => lastAssistantMsg.includes(kw));

  const handleEndSession = useCallback(async () => {
    setIsScoring(true);
    try {
      const res = await fetch("/api/fortune/chat/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setScore(data.score);
    } catch {
      // スコア取得失敗してもセッションは終了させる
    }
    setEnded(true);
    setIsScoring(false);
  }, [sessionId]);

  useEffect(() => {
    if (shouldAutoEnd) {
      handleEndSession();
    }
  }, [shouldAutoEnd, handleEndSession]);

  // Enter = 送信、Shift+Enter = 改行。IME変換確定時のEnterは無視
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isStreaming) return;
      const form = e.currentTarget.closest("form");
      if (form) form.requestSubmit();
    }
  };

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-hidden bg-[#0a0a1a]">
      <div className="stars" />
      <div className="stars2" />
      <div className="stars3" />

      {/* アストレア背景画像 — 画面状態で透過度を変える */}
      <div
        className={`pointer-events-none fixed inset-0 z-[1] bg-contain bg-center bg-no-repeat transition-opacity duration-1000 ${
          started ? (ended ? "opacity-40" : "opacity-10") : "opacity-60"
        }`}
        style={{ backgroundImage: "url('/images/astrea-full.webp')" }}
      />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-gradient-to-t from-[#0a0a1a] via-transparent to-transparent" />

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] flex-col">
        {/* ヘッダー */}
        <header className="flex-shrink-0 border-b border-purple-500/10 bg-[#0a0a1a]/90 px-4 py-5 backdrop-blur-md">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="bg-gradient-to-r from-purple-200 via-pink-200 to-amber-100 bg-clip-text text-xl font-medium tracking-[0.15em] text-transparent">
              星詠みの巫女 アストレア
            </h1>
            <p className="mt-1.5 text-[10px] tracking-[0.3em] text-purple-300/40">
              星と心理の交差点で、あなたの道を照らす
            </p>
          </div>
        </header>

        {/* ウェルカム or チャット */}
        {!started ? (
          <div className="flex flex-1 flex-col items-center justify-end px-6 pb-24">
            <div className="rounded-2xl bg-[#0a0a1a]/60 px-10 py-8 backdrop-blur-sm">
              <p className="mb-3 text-center text-sm tracking-[0.2em] text-purple-300/60">
                西洋占星術 × タロット × 数秘術
              </p>
              <p className="mb-8 text-center text-lg leading-loose text-purple-100/90">
                星々があなたの訪れを
                <br />
                待っておりました。
              </p>
              <button
                onClick={handleStart}
                className="group relative rounded-full bg-gradient-to-r from-purple-600/90 to-pink-600/90 px-10 py-4 text-sm font-medium tracking-widest text-white shadow-lg shadow-purple-500/20 transition-all duration-300 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10">鑑定を始める</span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
              </button>

              {/* 相談内容はサーバの DB に平文で残る。占いは打ち明け話が出やすい
                  ので、始める前に伝えておく (2026-08-07 セキュリティ監査の指摘)。
                  占い自体の位置づけも、後から言い訳しないよう先に置く */}
              <p className="mt-8 max-w-sm text-center text-[11px] leading-relaxed text-purple-300/40">
                お話しいただいた内容と生年月日は、鑑定のためにサーバへ保存されます。
                氏名・連絡先など、あなたを特定できる情報は入力しないでください。
                <br />
                占術は答えではなく、自分を映す鏡として扱っています。
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((msg, i) => (
                  <ChatBubble
                    key={i}
                    message={msg}
                    isLatest={i === messages.length - 1 && isStreaming}
                    status={i === messages.length - 1 ? status : null}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 入力エリア or お礼画面 */}
            {ended ? (
              <div className="fade-in flex-shrink-0 border-t border-purple-500/10 bg-[#0a0a1a]/90 px-4 py-8 backdrop-blur-md">
                <div className="mx-auto max-w-2xl text-center">
                  <p className="mb-2 text-lg tracking-wider text-purple-200/80">
                    本日の鑑定はここまでです
                  </p>
                  <p className="mb-6 text-sm text-purple-300/50">
                    星々があなたの道を照らし続けますように
                  </p>
                  {score !== null && (
                    <div className="mb-4 flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className={`text-lg ${i <= Math.round(score) ? "text-amber-300" : "text-purple-500/30"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-full border border-purple-400/20 px-8 py-3 text-sm tracking-wider text-purple-200/70 transition hover:border-purple-400/40 hover:text-purple-100"
                  >
                    新しい鑑定を始める
                  </button>
                </div>
              </div>
            ) : showTarot && !isStreaming && tarotDraws ? (
              <div className="flex-shrink-0 border-t border-purple-500/10 bg-[#0a0a1a]/90 px-4 py-6 backdrop-blur-md">
                <div className="mx-auto max-w-2xl">
                  {spreadId ? (
                    <TarotSpread
                      draws={tarotDraws}
                      onComplete={handleTarotComplete}
                      spread={findSpread(spreadId)}
                    />
                  ) : (
                    <SpreadChooser
                      spreads={SPREADS}
                      onSelect={handleSpreadSelect}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 border-t border-purple-500/10 bg-[#0a0a1a]/90 px-4 py-4 backdrop-blur-md">
                <form
                  onSubmit={handleSubmit}
                  className="mx-auto flex max-w-2xl gap-3"
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isStreaming
                        ? "アストレアが語っています..."
                        : "メッセージを入力..."
                    }
                    disabled={isStreaming}
                    rows={1}
                    style={{ maxHeight: "8rem" }}
                    className="flex-1 resize-none overflow-y-auto rounded-xl border border-purple-400/10 bg-[#16163a]/80 px-4 py-3 text-sm text-purple-50/90 placeholder-purple-400/30 outline-none transition-all duration-300 focus:border-purple-400/30 focus:shadow-[0_0_12px_rgba(139,92,246,0.2),0_0_24px_rgba(139,92,246,0.08)] disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={isStreaming || !input.trim()}
                    className="rounded-xl bg-gradient-to-r from-purple-600/80 to-pink-600/80 px-5 py-3 text-sm font-medium tracking-wider text-white/90 transition hover:from-purple-500/80 hover:to-pink-500/80 disabled:opacity-30"
                  >
                    送信
                  </button>
                </form>
                {userMessageCount >= 3 && !isStreaming && (
                  <div className="mx-auto mt-3 max-w-2xl text-center">
                    <button
                      onClick={handleEndSession}
                      disabled={isScoring}
                      className="rounded-full border border-purple-400/30 px-6 py-2 text-xs tracking-wider text-purple-300/70 transition hover:border-purple-400/50 hover:text-purple-200 disabled:opacity-30"
                    >
                      {isScoring ? "星に記録しています..." : "鑑定を終える"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* フッター */}
        <footer className="flex-shrink-0 py-2 text-center text-xs text-purple-400/30">
          Powered by Nexus_ai
        </footer>
      </div>
    </div>
  );
}

function useAppearAnimation(): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("message-appear");
  }, []);
  return ref;
}

function ChatBubble({
  message,
  isLatest,
  status,
}: {
  message: Message;
  isLatest: boolean;
  /** 本文が来る前に出す待ち状態。無ければ null */
  status: string | null;
}) {
  const isUser = message.role === "user";
  const appearRef = useAppearAnimation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      ref={appearRef}
      className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="astrea-icon mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-600/20 text-sm text-purple-300">
          ✦
        </div>
      )}
      <div className={`group relative max-w-[80%]`}>
        <div
          className={`rounded-2xl px-5 py-3.5 ${
            isUser
              ? "bg-purple-600/20 text-purple-100/90"
              : "astrea-bubble border border-purple-400/10 bg-[#12122a]/60 text-purple-50/85"
          }`}
        >
          <div className="whitespace-pre-wrap leading-relaxed">
            {!message.content && (isLatest || status) ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </span>
                {status && (
                  <span className="text-xs tracking-wider text-purple-300/60">
                    {status}
                  </span>
                )}
              </span>
            ) : (
              <>
                <FortuneText text={message.content} />
                {isLatest && (
                  <span className="streaming-cursor ml-0.5 inline-block" />
                )}
              </>
            )}
          </div>
        </div>
        {!isUser && message.content && !isLatest && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 right-0 rounded px-1.5 py-0.5 text-[10px] tracking-wider text-purple-400/40 opacity-0 transition-all duration-200 hover:text-purple-300/70 group-hover:opacity-100"
          >
            {copied ? "コピー済み" : "コピー"}
          </button>
        )}
      </div>
    </div>
  );
}

function FortuneText({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#### ")) {
      elements.push(
        <h4
          key={i}
          className="mt-4 mb-2 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-lg font-bold text-transparent"
        >
          {line.replace("#### ", "")}
        </h4>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="mt-5 mb-2 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-xl font-bold text-transparent"
        >
          {line.replace("### ", "")}
        </h3>,
      );
    } else if (line.trim() === "") {
      elements.push(<br key={i} />);
    } else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={j} className="text-amber-200">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </span>,
      );
    }
  }

  return <>{elements}</>;
}
