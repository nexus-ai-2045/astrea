// タロット図案の差し替え機構。
//
// 大アルカナ 22 枚の図案は一度に揃わない。MJ で作った試作は消失し、作り直しになった
// (2026-08-02 全ドライブ・git 履歴を捜索して不在を確認)。
// 揃うまで待つと機能全体が止まるので、**出来た札から順に差し替えられる**形にする。
//
// 使い方:
//   1. public/images/tarot/ に <2桁ゼロ埋め>.webp を置く (例 17.webp = 星)
//   2. 下の AVAILABLE_TAROT_ART にその番号を足す
//   3. 画像がある札だけ画像で描画され、無い札は現行の CSS デザインのままになる
//
// 一覧を手で持つのは、ビルド時に public/ を走査できない (クライアント側で動くため)
// のと、置いただけの未完成画像が勝手に出るのを防ぐため。

/**
 * 図案が用意できた大アルカナの番号。
 *
 * 空 = 全札が CSS デザイン。図案を追加したらここに番号を足す。
 */
export const AVAILABLE_TAROT_ART: number[] = [];

/** public 配下の図案パス。未用意なら null を返し、呼び出し側は CSS へ落とす。 */
export function tarotArtSrc(cardNumber: number): string | null {
  if (!Number.isInteger(cardNumber) || cardNumber < 0 || cardNumber > 21) {
    return null;
  }
  if (!AVAILABLE_TAROT_ART.includes(cardNumber)) return null;
  return `/images/tarot/${String(cardNumber).padStart(2, "0")}.webp`;
}
