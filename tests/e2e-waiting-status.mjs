/**
 * ロードマップ 1-c 「送信から何かが動き出すまで 0.5 秒以内」の実ブラウザ実測。
 *
 * 測るのは「操作 → 画面に待ち状態が出るまで」。driver の polling 間隔が混ざらない
 * よう、クリックの捕捉と DOM 変化の検知をどちらもページ内 (performance.now) で行う。
 *
 * 使い方 (production build を起動しておく):
 *   npm run build && npx next start -p 3100
 *   node tests/e2e-waiting-status.mjs http://127.0.0.1:3100
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const LIMIT_MS = 500;
const STATUS_TEXT = "星を読んでいます";

/** クリック時刻と「待ち状態が DOM に出た時刻」をページ内で記録する。 */
function installProbe(statusText) {
  const w = /** @type {Record<string, unknown>} */ (window);
  w.__clickAt = null;
  w.__statusAt = null;
  document.addEventListener(
    "click",
    () => {
      w.__clickAt = performance.now();
      w.__statusAt = null;
    },
    { capture: true },
  );
  const seen = () => document.body.innerText.includes(statusText);
  new MutationObserver(() => {
    if (w.__clickAt !== null && w.__statusAt === null && seen()) {
      w.__statusAt = performance.now();
    }
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];
const httpStatuses = [];

page.on("response", (res) => {
  if (res.url().includes("/api/fortune/chat")) {
    httpStatuses.push(res.status());
  }
});

/** クリック → 待ち状態の描画までの ms を取り出す。 */
async function measured(label) {
  const ms = await page.waitForFunction(
    () => {
      const w = /** @type {Record<string, number | null>} */ (window);
      return w.__statusAt === null || w.__clickAt === null
        ? null
        : w.__statusAt - w.__clickAt;
    },
    null,
    { timeout: 10000 },
  );
  results.push([label, Math.round(await ms.jsonValue())]);
}

try {
  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate(installProbe, STATUS_TEXT);

  // --- 1 回目: 「鑑定を始める」で出迎えを要求する ---
  await page.getByRole("button", { name: "鑑定を始める" }).click();
  await measured("鑑定を始める → 待ち状態の描画");

  // 出迎えが流れ終わるまで待つ (入力欄が有効に戻る)
  await page.waitForFunction(
    () => {
      const el = document.querySelector("textarea");
      return el !== null && !el.disabled;
    },
    null,
    { timeout: 180000 },
  );

  // --- 2 回目: 実際の送信操作から測る ---
  await page.getByPlaceholder("メッセージを入力...").fill("1990年5月3日です");
  await page.getByRole("button", { name: "送信" }).click();
  await measured("送信 → 待ち状態の描画");
} finally {
  // 吹き出しのフェードインが終わってから撮る (待ち状態が読める絵にするため)
  await page.waitForTimeout(600).catch(() => {});
  const shot = "screenshots/waiting-status.png";
  await page.screenshot({ path: shot }).catch(() => {});
  await browser.close();
  console.log(`screenshot: ${shot}`);
}

console.log(`chat HTTP: ${httpStatuses.join(", ") || "なし"}`);
let failed = httpStatuses.some((s) => s !== 200);
for (const [label, ms] of results) {
  const ok = ms <= LIMIT_MS;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${ms} ms (上限 ${LIMIT_MS} ms)`);
}
process.exit(failed ? 1 : 0);
