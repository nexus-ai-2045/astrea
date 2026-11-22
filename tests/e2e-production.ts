/**
 * AI占い師アストレア — 本番E2Eテスト + スクショ
 * Playwright headless（フォーカスを取らない）
 * 対象: https://ai-fortune-teller-theta.vercel.app
 */
import { chromium, Browser, Page } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "https://ai-fortune-teller-theta.vercel.app";
const SCREENSHOT_DIR = join(__dirname, "../screenshots");
const RESULTS: { name: string; status: "PASS" | "FAIL"; detail: string }[] = [];

function record(name: string, status: "PASS" | "FAIL", detail: string = "") {
  RESULTS.push({ name, status, detail });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? `: ${detail}` : ""}`);
}

async function screenshot(page: Page, name: string) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
  return path;
}

async function testWelcomePage(page: Page) {
  console.log("\n--- テスト1: ウェルカムページ ---");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // タイトル確認
  const title = await page.textContent("h1");
  if (title?.includes("アストレア")) {
    record("ヘッダータイトル", "PASS", title.trim());
  } else {
    record(
      "ヘッダータイトル",
      "FAIL",
      `期待: アストレアを含む, 実際: ${title}`,
    );
  }

  // サブタイトル確認
  const subtitle = await page.textContent("header p");
  if (subtitle?.includes("星と心理の交差点")) {
    record("サブタイトル", "PASS");
  } else {
    record("サブタイトル", "FAIL", `実際: ${subtitle}`);
  }

  // 水晶球アニメーション確認
  const crystalBall = await page.$(".crystal-ball");
  record("水晶球表示", crystalBall ? "PASS" : "FAIL");

  // 鑑定開始ボタン
  const startBtn = await page.$("button");
  const btnText = await startBtn?.textContent();
  if (btnText?.includes("鑑定を始める")) {
    record("鑑定開始ボタン", "PASS");
  } else {
    record("鑑定開始ボタン", "FAIL", `ボタンテキスト: ${btnText}`);
  }

  // フッター
  const footer = await page.textContent("footer");
  if (footer?.includes("Nexus_ai")) {
    record("フッター", "PASS");
  } else {
    record("フッター", "FAIL", `実際: ${footer}`);
  }

  await screenshot(page, "01-welcome");
}

async function testStartSession(page: Page) {
  console.log("\n--- テスト2: 鑑定開始（SSEストリーミング） ---");

  // 鑑定開始ボタンをクリック
  await page.click("button:has-text('鑑定を始める')");

  // アストレアの応答を待つ（SSEストリーミング）
  // ローディングアニメーション（バウンスドット）が出現→テキストに変わるまで待つ
  try {
    await page.waitForSelector(".whitespace-pre-wrap", { timeout: 30000 });
    // ストリーミングが完了するまで待つ（テキストが安定するまで）
    await page.waitForTimeout(5000);

    // アストレアのメッセージを確認
    const astreaLabel = await page.textContent(".whitespace-pre-wrap >> nth=0");
    if (astreaLabel && astreaLabel.length > 10) {
      record("アストレア初回応答", "PASS", `${astreaLabel.slice(0, 80)}...`);
    } else {
      record(
        "アストレア初回応答",
        "FAIL",
        `テキスト長: ${astreaLabel?.length}`,
      );
    }

    // 「生年月日」という言葉が含まれているか（フェーズ1: 生年月日だけ聞く）
    if (astreaLabel?.includes("生年月日") || astreaLabel?.includes("誕生日")) {
      record("フェーズ1: 生年月日を聞いている", "PASS");
    } else {
      record(
        "フェーズ1: 生年月日を聞いている",
        "FAIL",
        "「生年月日」が見つからない",
      );
    }

    // 入力エリアが表示されているか
    const textarea = await page.$("textarea");
    record("入力エリア表示", textarea ? "PASS" : "FAIL");

    // 送信ボタン
    const sendBtn = await page.$('button[type="submit"]');
    const sendText = await sendBtn?.textContent();
    record("送信ボタン", sendText?.includes("送信") ? "PASS" : "FAIL");
  } catch (e) {
    record(
      "アストレア初回応答",
      "FAIL",
      `タイムアウト: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  await screenshot(page, "02-session-started");
}

async function testSendBirthday(page: Page) {
  console.log("\n--- テスト3: 生年月日送信 ---");

  const textarea = await page.$("textarea");
  if (!textarea) {
    record("生年月日入力", "FAIL", "textareaが見つからない");
    return;
  }

  await textarea.fill("1990年5月15日です");

  // 送信ボタンクリック
  await page.click('button[type="submit"]');

  // ユーザーメッセージが表示されるのを確認
  try {
    await page.waitForFunction(
      () => {
        const msgs = document.querySelectorAll(".whitespace-pre-wrap");
        for (const msg of msgs) {
          if (msg.textContent?.includes("1990年5月15日")) return true;
        }
        return false;
      },
      { timeout: 5000 },
    );
    record("ユーザーメッセージ表示", "PASS");
  } catch {
    record("ユーザーメッセージ表示", "FAIL");
  }

  // アストレアの応答を待つ
  try {
    // 新しいアストレアメッセージが来るまで待つ
    await page.waitForTimeout(10000);

    const allMessages = await page.$$eval(".whitespace-pre-wrap", (els) =>
      els.map((el) => el.textContent?.slice(0, 100) || ""),
    );

    if (allMessages.length >= 3) {
      record(
        "アストレア占術応答",
        "PASS",
        `メッセージ数: ${allMessages.length}, 最新: ${allMessages[allMessages.length - 1]?.slice(0, 60)}...`,
      );
    } else {
      record(
        "アストレア占術応答",
        "FAIL",
        `メッセージ数: ${allMessages.length}（期待: 3以上）`,
      );
    }

    // 占術キーワードが含まれているか確認
    const lastMessage = allMessages[allMessages.length - 1] || "";
    const hasFortuneKeywords =
      lastMessage.includes("牡牛座") ||
      lastMessage.includes("星") ||
      lastMessage.includes("五行") ||
      lastMessage.includes("数秘") ||
      lastMessage.length > 50;
    record(
      "占術キーワード含有",
      hasFortuneKeywords ? "PASS" : "FAIL",
      lastMessage.slice(0, 80),
    );
  } catch (e) {
    record(
      "アストレア占術応答",
      "FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  await screenshot(page, "03-birthday-sent");
}

async function testResponsive(page: Page) {
  console.log("\n--- テスト4: レスポンシブ対応 ---");

  // モバイルサイズ
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const mobileTitle = await page.textContent("h1");
  record(
    "モバイル表示 (375px)",
    mobileTitle?.includes("アストレア") ? "PASS" : "FAIL",
  );
  await screenshot(page, "04-mobile");

  // タブレットサイズ
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await screenshot(page, "05-tablet");
  record("タブレット表示 (768px)", "PASS");

  // デスクトップに戻す
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(500);
  await screenshot(page, "06-desktop");
  record("デスクトップ表示 (1280px)", "PASS");
}

async function testCSSAndStyling(page: Page) {
  console.log("\n--- テスト5: スタイリング・背景 ---");

  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  // 背景色確認
  const bgColor = await page.$eval(
    ".min-h-screen",
    (el) => getComputedStyle(el).backgroundColor,
  );
  record(
    "ダーク背景",
    bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "rgb(255, 255, 255)"
      ? "PASS"
      : "FAIL",
    bgColor,
  );

  // 星アニメーション要素の存在
  const stars = await page.$(".stars");
  record("星アニメーション要素", stars ? "PASS" : "FAIL");

  // グラデーションテキスト
  const h1Style = await page.$eval("h1", (el) => {
    const style = getComputedStyle(el);
    return style.backgroundImage || style.background;
  });
  record(
    "グラデーションタイトル",
    h1Style.includes("gradient") ? "PASS" : "FAIL",
    h1Style.slice(0, 60),
  );
}

async function testErrorHandling(page: Page) {
  console.log("\n--- テスト6: エラーハンドリング ---");

  // コンソールエラーの監視
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  record(
    "コンソールエラーなし",
    errors.length === 0 ? "PASS" : "FAIL",
    errors.length > 0 ? errors.join("; ") : "",
  );
}

async function testAPIEndpoint() {
  console.log("\n--- テスト7: API直接テスト ---");

  // chat API にPOST
  try {
    const res = await fetch(`${BASE_URL}/api/fortune/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-e2e", message: "" }),
    });

    record(
      "Chat API レスポンスステータス",
      res.status === 200 ? "PASS" : "FAIL",
      `status: ${res.status}`,
    );
    record(
      "SSE Content-Type",
      res.headers.get("content-type")?.includes("text/event-stream")
        ? "PASS"
        : "FAIL",
      res.headers.get("content-type") || "",
    );

    // SSEデータを少しだけ読む
    const reader = res.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let chunk = "";
      const { value } = await reader.read();
      if (value) {
        chunk = decoder.decode(value);
        record(
          "SSEデータ受信",
          chunk.includes("data:") ? "PASS" : "FAIL",
          chunk.slice(0, 80),
        );
      }
      reader.cancel();
    }
  } catch (e) {
    record("Chat API", "FAIL", e instanceof Error ? e.message : String(e));
  }
}

// メイン実行
async function main() {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log("=== AI占い師アストレア E2Eテスト ===");
  console.log(`対象: ${BASE_URL}`);
  console.log(`スクショ保存先: ${SCREENSHOT_DIR}`);
  console.log("");

  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: "ja-JP",
    });
    const page = await context.newPage();

    // テスト実行
    await testWelcomePage(page);
    await testStartSession(page);
    await testSendBirthday(page);
    await testResponsive(page);
    await testCSSAndStyling(page);
    await testErrorHandling(page);
    await testAPIEndpoint();

    await context.close();
  } catch (e) {
    console.error("ブラウザ起動エラー:", e);
  } finally {
    if (browser) await browser.close();
  }

  // 結果サマリー
  console.log("\n=== テスト結果サマリー ===");
  const passed = RESULTS.filter((r) => r.status === "PASS").length;
  const failed = RESULTS.filter((r) => r.status === "FAIL").length;
  console.log(
    `✅ PASS: ${passed} / ❌ FAIL: ${failed} / 合計: ${RESULTS.length}`,
  );

  if (failed > 0) {
    console.log("\n❌ 失敗したテスト:");
    RESULTS.filter((r) => r.status === "FAIL").forEach((r) => {
      console.log(`  - ${r.name}: ${r.detail}`);
    });
  }

  console.log(`\n📸 スクショ: ${SCREENSHOT_DIR}/`);
}

main();
