import { describe, it, expect } from "vitest";
import { drawCards, tarotDrawToPromptContext } from "./tarot";
import { CHAT_SYSTEM_PROMPT } from "./system-prompt";
import {
  calculateAllFortunes,
  extractBirthdayInfoFromMessages,
  fortuneResultToPromptContext,
} from "./fortune-engine";
import { buildFortunePrompt } from "./fortune-prompt";

const ENGINE_TAROT_HEADING = "【タロット — 三枚引き】";
const DRAWN_TAROT_HEADING = "【タロット鑑定】";

function contextFor(includeTarot: boolean): string {
  const info = extractBirthdayInfoFromMessages([
    { role: "user", content: "1990年5月3日です" },
  ]);
  const result = calculateAllFortunes(info!.parsed, "fixed-session");
  return fortuneResultToPromptContext(result!, { includeTarot });
}

describe("タロットの出所は1つだけ", () => {
  // 占術エンジンは sessionId から独自に 3 枚引く (fortune-engine の drawTarot)。
  // 一方 UI は tarot.ts の drawCards で引いた 3 枚を相談者に見せる。
  // 両方をプロンプトに載せると「画面で見たカード」と「鑑定の根拠」が食い違う。
  // 相談者が見た側を正とし、エンジン側は載せない。
  it("既定ではエンジンのタロットを含む (既存の呼び出しを壊さない)", () => {
    expect(contextFor(true)).toContain(ENGINE_TAROT_HEADING);
  });

  it("includeTarot:false でエンジンのタロット節だけが消える", () => {
    const context = contextFor(false);
    expect(context).not.toContain(ENGINE_TAROT_HEADING);
    expect(context).toContain("太陽星座:");
    expect(context).toContain("ライフパスナンバー:");
  });

  it("実際に組み立てたプロンプトにタロット節が二重に出ない", () => {
    const prompt = buildFortunePrompt({
      fortuneContext: contextFor(false),
      ragContext: null,
      tarotContext: tarotDrawToPromptContext(drawCards(3)),
      history: [{ role: "user", content: "1990年5月3日です" }],
    });
    expect(prompt).not.toContain(ENGINE_TAROT_HEADING);
    expect(prompt.split(DRAWN_TAROT_HEADING).length - 1).toBe(1);
  });
});

describe("tarot integration", () => {
  describe("system prompt", () => {
    it("フェーズ1でアイスブレイク質問を含む", () => {
      expect(CHAT_SYSTEM_PROMPT).toContain("フェーズ1");
      // 生年月日だけでなく、気持ちや状況も聞く
      expect(CHAT_SYSTEM_PROMPT).toMatch(/気持ち|心境|状況|気分/);
    });

    it("タロットフェーズの説明がある", () => {
      expect(CHAT_SYSTEM_PROMPT).toMatch(/タロット/);
      // カードを選ぶ体験についての記述
      expect(CHAT_SYSTEM_PROMPT).toMatch(/カード/);
    });
  });

  describe("tarot prompt injection", () => {
    it("タロット結果を占術結果と結合してプロンプトに注入できる", () => {
      const draws = drawCards(3);
      const tarotContext = tarotDrawToPromptContext(draws);
      const fortuneContext = "【占術結果】\n西洋占星術: 牡羊座";

      // 両方を結合した文字列がシステムプロンプトに追加される想定
      const combined = `${fortuneContext}\n\n${tarotContext}`;

      expect(combined).toContain("【占術結果】");
      expect(combined).toContain("【タロット鑑定】");
      expect(combined).toContain("枚目:");
    });

    it("タロット3枚の結果がすべてプロンプトに含まれる", () => {
      const draws = drawCards(3);
      const context = tarotDrawToPromptContext(draws);

      expect(context).toContain("1枚目:");
      expect(context).toContain("2枚目:");
      expect(context).toContain("3枚目:");
    });
  });
});

describe("system prompt が実装と一致している", () => {
  // 2026-07-28: UX を「1枚選ぶと残りも自動で開く」→「3枚とも自分でめくる」に
  // 変えたのに system prompt が旧仕様のままで、アストレアが実際の画面と違う
  // 説明をしていた (実ログ: 「他の2枚も、静かに光を纏いながらめくれていきます」)。
  // プロンプトは仕様書でもあるので、UX を変えたらここも追随させる。
  it("自動でめくれるとは言わない", () => {
    expect(CHAT_SYSTEM_PROMPT).not.toContain("残りも含めて順番にめくれる");
  });

  it("相談者が3枚とも自分でめくると書いてある", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/3枚とも.*めくる|自分の手でめくる/);
  });

  it("めくった順が位置になると書いてある", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/めくった順/);
  });
});

describe("展開法の選択が system prompt に反映されている", () => {
  // 相談内容に応じて 3 つ提示 → 相談者が 1 つ選ぶ、という流れ (CEO 指示)。
  // 一覧そのものは route が動的に渡すので、ここには「手順」だけを書く。
  it("3つ提示して選んでもらう手順が書いてある", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/3つ.*(提示|選んで)|展開法/);
  });

  it("一覧に無い展開法を作らない指示がある", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/一覧に無い|勝手に作らない/);
  });

  it("3枚を物語として読む指示がある（プロの実務知）", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/物語/);
  });

  it("誰にでも当てはまる曖昧表現を禁じている（ストックスピール禁止）", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/誰にでも当てはま/);
  });

  it("自己反省を強化する立場が明記されている（依存対策）", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/代替|自分で考える/);
  });
});

describe("プロンプトが実際の画面操作と一致している", () => {
  // 2026-07-28 の再発防止。UX を変えたのに prompt が旧仕様のままで、
  // アストレアが画面と違う説明をした (「他の2枚も自然にめくれていきます」)。
  // 展開法の選択は「画面のボタンをタップ」で行うので、チャットで番号を
  // 答えさせる言い方をさせない。
  it("展開法は画面の一覧から選ぶと書いてある", () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/画面.*(一覧|選択|選ん)/);
  });

  // 「番号で答えて」は禁止例として prompt 内に**書いてある**ので、単純な
  // 部分文字列禁止では「指示している」のと「禁じている」のを区別できない
  // (system-prompt.test.ts の「誰にでも当てはまる」と同じ構図)。
  // 出現するなら必ず禁止文脈であること、を条件にする。
  it("チャットで番号を答えさせる言い方が、禁止として書かれている", () => {
    const idx = CHAT_SYSTEM_PROMPT.indexOf("番号で");
    if (idx === -1) return;
    const nearby = CHAT_SYSTEM_PROMPT.slice(idx, idx + 160);
    expect(nearby, "禁止文脈で使われていること").toMatch(
      /しない|避ける|禁止/,
    );
  });

  it("めくった順が位置になることを相談者に伝える指示がある", () => {
    // labelsByRevealOrder が画面に出すのと同じ規則を、言葉でも伝えさせる
    expect(CHAT_SYSTEM_PROMPT).toMatch(/めくった順.*位置|順.*位置になる/);
  });
});
