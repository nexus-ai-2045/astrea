/**
 * 体感レイテンシの実測。ロードマップ Phase 1-a / 1-b / 1-c の完了条件を数値で出す。
 *
 * 測るのは「アプリの入口から」。CLI 単体ではなく SSE エンドポイントを叩き、
 * 送信 → 最初のフレーム (状態表示) → 最初の本文 → 完了 を記録する。
 *
 * 使い方 (production build を別ターミナルで起動しておく):
 *   npm run build
 *   npx next start -p 3100
 *   node tests/measure-chat-latency.mjs http://127.0.0.1:3100
 *
 * dev server では毎回コンパイルが入るので体感計測には使わない。
 */

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const sessionId = crypto.randomUUID();

/** SSE を 1 往復読み、各イベントの経過ミリ秒を記録する。 */
async function turn(label, body) {
  const started = performance.now();
  const marks = { firstFrame: null, firstText: null, done: null };
  let text = "";
  let statuses = [];

  const res = await fetch(`${BASE}/api/fortune/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // docs (streaming.md) の推奨どおり compression 層のバッファを外す
      "Accept-Encoding": "identity",
    },
    body: JSON.stringify({ sessionId, ...body }),
  });
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const at = performance.now() - started;
    if (marks.firstFrame === null) marks.firstFrame = at;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (!frame.startsWith("data: ")) continue;
      const event = JSON.parse(frame.slice(6));
      if (event.type === "status") statuses.push([Math.round(at), event.content]);
      if (event.type === "text") {
        if (marks.firstText === null) marks.firstText = at;
        text += event.content;
      }
      if (event.type === "done") marks.done = at;
      if (event.type === "error") throw new Error(`${label}: ${event.content}`);
    }
  }
  const total = performance.now() - started;

  const end = marks.done ?? total;
  // 本文が流れ始めてから終わるまでの速度。完了時刻の下限を決めているのはここ
  const rate =
    marks.firstText === null || end <= marks.firstText
      ? null
      : text.length / ((end - marks.firstText) / 1000);

  console.log(
    [
      `# ${label}`,
      `  最初のフレーム : ${fmt(marks.firstFrame)}`,
      `  最初の本文     : ${fmt(marks.firstText)}`,
      `  完了 (done)    : ${fmt(end)}`,
      `  本文字数       : ${text.length}`,
      `  出力速度       : ${rate === null ? "—" : `${rate.toFixed(1)} 字/秒`}`,
      `  status         : ${statuses.map(([ms, s]) => `${ms}ms "${s}"`).join(" / ") || "なし"}`,
    ].join("\n"),
  );
  return { label, ...marks, total, chars: text.length, rate };
}

function fmt(ms) {
  return ms === null ? "—" : `${Math.round(ms)} ms`;
}

const rows = [];
rows.push(await turn("turn1 出迎え (cold: プロセス起動込み)", { message: "" }));
rows.push(await turn("turn2 生年月日 (命式が判明)", { message: "1990年5月3日です" }));
rows.push(
  await turn("turn3 タロット3枚 (本鑑定)", {
    message: "",
    tarotDraws: [
      { number: 0, isReversed: false },
      { number: 7, isReversed: true },
      { number: 17, isReversed: false },
    ],
  }),
);
rows.push(await turn("turn4 短い相談 (warm)", { message: "仕事のことで迷っています" }));
rows.push(await turn("turn5 短い相談 (warm)", { message: "転職を考えています" }));

console.log("\n=== まとめ ===");
console.log("label\tfirstFrame\tfirstText\tdone\tchars\t字/秒");
for (const r of rows) {
  console.log(
    [
      r.label,
      Math.round(r.firstFrame ?? -1),
      Math.round(r.firstText ?? -1),
      Math.round(r.done ?? r.total),
      r.chars,
      r.rate === null ? "—" : r.rate.toFixed(1),
    ].join("\t"),
  );
}
