/**
 * セッション終了時にスコアをサーバーへ送信する。
 * navigator.sendBeacon を使用し、Blob で application/json を保証する。
 */
export function sendScore(sessionId: string): void {
  if (!navigator.sendBeacon) return;
  navigator.sendBeacon(
    "/api/fortune/chat/score",
    new Blob([JSON.stringify({ sessionId })], { type: "application/json" }),
  );
}
