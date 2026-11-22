# Contributing

## 開発の前に読むもの

`AGENTS.md` に一行だけ重要なことが書いてあります。**この Next.js は訓練データの
Next.js ではありません。** コードを書く前に `node_modules/next/dist/docs/` の
該当ガイドを読んでください。`middleware.ts` は `proxy.ts` になり、
`NextRequest.ip` は無くなっています。

## セットアップ

```bash
npm install
npm run dev
```

LLM の呼び出しはローカルの `claude` CLI 経由です。API キーは使いません。
CLI の認証が無い環境では file-backed の bridge で UI を通し確認できます。

```bash
FORTUNE_DEV_BRIDGE=1 npm start
```

`.dev-bridge/<sessionId>.NNN.request.md` にプロンプトが書き出されるので、
同じ base 名の `.response.md` を書くとアプリがそれを配信します。

## テスト

```bash
npm test          # vitest
npx tsc --noEmit
npm run build
```

テストはソースの隣に `*.test.ts` として置きます。DOM が要る file は先頭に
`// @vitest-environment jsdom` を書いてください。

## 進め方

**テストを先に書いて、RED を確認してから実装します。** 実装が先に出来上がって
いる PR は、テストが本当に落ちるのかが分からないので確認に時間がかかります。

テストが落ちたときは実装を直します。テスト自体が間違っている場合だけテストを
直し、その理由をコメントで残してください。実例として
`src/lib/system-prompt.test.ts` に、禁止語の単純な部分文字列判定を文脈判定へ
変えたときの記録があります。

## プロンプトは仕様書でもある

`src/lib/system-prompt.ts` は UI の挙動を言葉で説明しています。UX を変えたら
必ずここも追随させてください。過去に「1枚選ぶと残りも自動で開く」から
「3枚とも自分でめくる」へ変えたのに prompt が旧仕様のままで、アストレアが
画面と違う説明を相談者にした事故があります。この種の食い違いは
`src/lib/tarot-integration.test.ts` で固定しています。

## コメント

日本語で書いてください。識別子は英語です。

「何をしているか」ではなく「**なぜそうなっているか**」を書きます。特に、
一度踏んだ失敗と、その結果いまの形になった理由は残す価値があります。

## コミット

Conventional Commits に従います。

```
feat(tarot): 展開法の選択をUIから到達可能にする
fix(prompt): UXと食い違っていた説明を直す
```

## PR を出す前に

`npm test` / `tsc --noEmit` / `npm run build` の3つを通してください。
UI に触れた PR は、実際にブラウザで動かした結果も書いてください。
