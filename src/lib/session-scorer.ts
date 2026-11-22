// セッション自動採点 — PDCA最小実装
// 対話ログからユーザーの「体験精度」を自動計測する

export type SessionMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SignalResult = {
  positiveCount: number;
  negativeCount: number;
};

// ポジティブシグナルのパターン
const POSITIVE_PATTERNS = [
  /当たって/,
  /まさに/,
  /そうなんです/,
  /すごい/,
  /なんでわかる/,
  /見透かされ/,
  /びっくり/,
  /その通り/,
  /ほんとに/,
  /言い当て/,
  /鳥肌/,
  /救われ/,
  /腑に落ち/,
  /スッキリ/,
  /そうそう/,
  /わかってもらえ/,
];

// ネガティブシグナルのパターン
const NEGATIVE_PATTERNS = [
  /うーん/,
  /ちょっと違う/,
  /そうかなぁ/,
  /ピンと来ない/,
  /当てはまらない/,
  /違うと思う/,
  /そうでもない/,
  /微妙/,
];

/**
 * 対話ログからポジティブ/ネガティブのシグナルを検出する
 * ユーザーのメッセージのみを対象とする
 */
export function detectSignals(messages: SessionMessage[]): SignalResult {
  let positiveCount = 0;
  let negativeCount = 0;

  for (const msg of messages) {
    if (msg.role !== "user") continue;

    const content = msg.content;

    for (const pattern of POSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        positiveCount++;
        break; // 1メッセージにつき最大1カウント
      }
    }

    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(content)) {
        negativeCount++;
        break;
      }
    }
  }

  return { positiveCount, negativeCount };
}

/**
 * セッション全体の体験精度スコアを算出する（1〜5）
 *
 * 計算ロジック:
 * - ベースライン: 3.0
 * - ポジティブシグナル: +0.5/件
 * - ネガティブシグナル: -0.5/件
 * - 没入ボーナス: メッセージ数8以上で+0.3、12以上で+0.5
 * - 最終的に1〜5にクランプ
 */
export function calculateSessionScore(
  signals: SignalResult,
  messageCount: number,
): number {
  const BASELINE = 3.0;
  const SIGNAL_WEIGHT = 0.5;

  let score = BASELINE;

  // シグナルによる加減
  score += signals.positiveCount * SIGNAL_WEIGHT;
  score -= signals.negativeCount * SIGNAL_WEIGHT;

  // 没入ボーナス（長く対話した = 没入している）
  if (messageCount >= 12) {
    score += 0.5;
  } else if (messageCount >= 8) {
    score += 0.3;
  }

  // 1〜5にクランプ
  return Math.max(1, Math.min(5, score));
}

export type SessionScoreResult = {
  score: number;
  signals: SignalResult;
  messageCount: number;
};

/**
 * セッション全体を一括スコアリングする統合関数
 */
export function scoreSession(messages: SessionMessage[]): SessionScoreResult {
  const signals = detectSignals(messages);
  const score = calculateSessionScore(signals, messages.length);
  return { score, signals, messageCount: messages.length };
}
