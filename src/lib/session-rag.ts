// 成功セッションRAG — PDCA Phase 2
// 似た命式の高スコアセッションを検索し、プロンプトに注入する

import { getAdapter, type DbAdapter } from "./db";

// 命式の検索キー（v3: 西洋占星術 + 数秘術。日干は削除）
export type FortuneKeys = {
  zodiacSign: string | null; // 太陽星座（牡羊座、牡牛座...）
  lifePath: number | null; // ライフパスナンバー（1-9, 11, 22, 33）
};

// 類似セッション検索結果
export type SimilarSession = {
  sessionId: string;
  score: number;
  matchType: "zodiacSign" | "lifePath";
  assistantMessages: string[];
};

/**
 * fortune_context文字列から命式キーを抽出する
 */
export function extractFortuneKeys(context: string): FortuneKeys {
  const keys: FortuneKeys = {
    zodiacSign: null,
    lifePath: null,
  };

  // 太陽星座: "太陽星座: X（" のパターン
  const zodiacMatch = context.match(/太陽星座:\s*([^\s（(]+)/);
  if (zodiacMatch) {
    keys.zodiacSign = zodiacMatch[1];
  }

  // ライフパスナンバー: "ライフパスナンバー: N"
  const lifePathMatch = context.match(/ライフパスナンバー:\s*(\d+)/);
  if (lifePathMatch) {
    keys.lifePath = parseInt(lifePathMatch[1]);
  }

  return keys;
}

/**
 * 命式キーをDBに保存する
 */
export async function saveFortuneKeys(
  sessionId: string,
  keys: FortuneKeys,
): Promise<void> {
  const db = getAdapter();
  await db.execute(
    `INSERT OR REPLACE INTO session_fortune_keys (session_id, day_stem, zodiac_sign, life_path)
     VALUES (?, ?, ?, ?)`,
    [sessionId, null, keys.zodiacSign, keys.lifePath],
  );
}

/**
 * このセッションの鑑定文を、他の相談者への参考として再利用してよいと記録する。
 *
 * **HTTP から呼ばない。** 運用者が中身を読んで判断したときだけ使う。
 *
 * スコアは `detectSignals` が相談者自身の発話から正規表現で付けるので、
 * 相談者が自分で吊り上げられる。一方 system prompt はアストレアに
 * 「相談者の言葉を必ず1つ以上拾って返す」よう指示している。この2つが繋がると、
 * 自分の文言をアストレアに復唱させ、高スコアを自己申告し、星座かライフパスが
 * 一致する見知らぬ来訪者のプロンプトへ逐語で送り込める。
 * 「運用者が目で見て許可した」を必須条件にすることで、この経路を断つ。
 */
export async function approveSessionForReuse(sessionId: string): Promise<void> {
  const db = getAdapter();
  await db.execute("UPDATE sessions SET rag_approved = 1 WHERE id = ?", [
    sessionId,
  ]);
}

/**
 * 似た命式の高スコアセッションを検索する。
 *
 * 条件は「スコアが閾値以上」かつ「運用者が再利用を許可済み」。
 * 後者が無いと相談者が自分でスコアを操作して混入できる (approveSessionForReuse 参照)。
 */
export async function findSimilarSessions(
  keys: FortuneKeys,
  topK: number = 3,
  minScore: number = 3.5,
): Promise<SimilarSession[]> {
  const db = getAdapter();
  const results: SimilarSession[] = [];
  const seenIds = new Set<string>();

  // 星座一致（v3: 最優先）
  if (keys.zodiacSign) {
    const { rows } = await db.execute(
      `SELECT fk.session_id, s.score
       FROM session_fortune_keys fk
       JOIN sessions s ON fk.session_id = s.id
       WHERE fk.zodiac_sign = ? AND s.score >= ? AND s.rag_approved = 1
       ORDER BY s.score DESC
       LIMIT ?`,
      [keys.zodiacSign, minScore, topK - results.length],
    );

    for (const row of rows) {
      const sid = row.session_id as string;
      if (!seenIds.has(sid)) {
        seenIds.add(sid);
        results.push({
          sessionId: sid,
          score: row.score as number,
          matchType: "zodiacSign",
          assistantMessages: await getAssistantMessages(db, sid),
        });
      }
    }
  }

  // ライフパスナンバー一致
  if (keys.lifePath && results.length < topK) {
    const { rows } = await db.execute(
      `SELECT fk.session_id, s.score
       FROM session_fortune_keys fk
       JOIN sessions s ON fk.session_id = s.id
       WHERE fk.life_path = ? AND s.score >= ? AND s.rag_approved = 1
       ORDER BY s.score DESC
       LIMIT ?`,
      [keys.lifePath, minScore, topK - results.length],
    );

    for (const row of rows) {
      const sid = row.session_id as string;
      if (!seenIds.has(sid)) {
        seenIds.add(sid);
        results.push({
          sessionId: sid,
          score: row.score as number,
          matchType: "lifePath",
          assistantMessages: await getAssistantMessages(db, sid),
        });
      }
    }
  }

  return results.slice(0, topK);
}

async function getAssistantMessages(
  db: DbAdapter,
  sessionId: string,
): Promise<string[]> {
  const { rows } = await db.execute(
    "SELECT content FROM messages WHERE session_id = ? AND role = 'assistant' ORDER BY id",
    [sessionId],
  );
  return rows.map((r) => r.content as string);
}

/**
 * 成功セッションからプロンプト注入テキストを生成する
 */
export function buildRagContext(sessions: SimilarSession[]): string | null {
  if (sessions.length === 0) return null;

  const matchTypeLabels: Record<string, string> = {
    zodiacSign: "星座一致",
    lifePath: "ライフパスナンバー一致",
  };

  const lines = [
    "=== 参考: 過去の成功鑑定パターン（高スコアセッションから抽出） ===",
    "",
    "以下は似た命式の相談者に対して高い満足度を得た鑑定の参考パターンです。",
    "これらを参考にしつつ、目の前の相談者に合わせた独自の鑑定をしてください。",
    "丸写しではなく、表現やアプローチのヒントとして使うこと。",
    "",
  ];

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    lines.push(
      `--- 参考パターン ${i + 1}（${matchTypeLabels[s.matchType]}、スコア: ${s.score}） ---`,
    );
    const msgs = s.assistantMessages.slice(0, 2);
    for (const msg of msgs) {
      const trimmed = msg.length > 500 ? msg.slice(0, 500) + "..." : msg;
      lines.push(trimmed);
    }
    lines.push("");
  }

  lines.push("=== 参考パターンここまで。目の前の相談者に集中してください ===");

  return lines.join("\n");
}

/**
 * Epsilon-Greedy: 確率的にRAGを使うか新規探索するかを決定
 */
export function shouldUseRag(epsilon: number = 0.1): boolean {
  return Math.random() >= epsilon;
}
