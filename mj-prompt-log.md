# Midjourney Prompt Test Log — アストレア Round 1

## テスト方針

- 1カテゴリ3バリエーション（媒体/スタイルを変数分離）
- 共通ベース: 紫+黒の神秘的世界観、星、水晶
- MJ V7, `--draft` で高速テスト（気に入ったら本生成）

---

## A. OGP/シェア画像 (1200x630 → --ar 40:21)

テスト変数: **スタイル**

### A-1: シネマティック写実

```
A mystical fortune teller's crystal ball glowing with purple light, floating above an ancient star chart, deep space background with constellations, cinematic photography style, volumetric purple and gold light rays, dramatic composition --ar 40:21 --v 7 --draft
```

### A-2: デジタルアート

```
A mystical fortune teller's crystal ball glowing with purple light, floating above an ancient star chart, deep space background with constellations, digital art illustration style, vibrant purple and gold gradients, dramatic composition --ar 40:21 --v 7 --draft
```

### A-3: 浮世絵×サイバーパンク融合

```
A mystical fortune teller's crystal ball glowing with purple light, floating above an ancient star chart, deep space background with constellations, ukiyo-e meets cyberpunk style, neon purple and gold accents, dramatic composition --ar 40:21 --v 7 --draft
```

---

## B. アストレアのキャラクター画像 (正方形 → --ar 1:1)

テスト変数: **描画媒体**

### B-1: セミリアル（ゲームCG風）

```
Portrait of Astrea, a mystical Japanese shrine maiden fortune teller, long flowing dark hair with purple starlight reflections, wearing an ethereal white and purple robe, holding a glowing crystal orb, starry night background, semi-realistic game CG style, soft rim lighting --ar 1:1 --v 7 --draft
```

### B-2: アニメ風

```
Portrait of Astrea, a mystical Japanese shrine maiden fortune teller, long flowing dark hair with purple starlight reflections, wearing an ethereal white and purple robe, holding a glowing crystal orb, starry night background, anime illustration style, detailed cel shading --ar 1:1 --v 7 --draft
```

### B-3: 油絵風ファンタジー

```
Portrait of Astrea, a mystical Japanese shrine maiden fortune teller, long flowing dark hair with purple starlight reflections, wearing an ethereal white and purple robe, holding a glowing crystal orb, starry night background, oil painting fantasy art style, rich textures --ar 1:1 --v 7 --draft
```

---

## C. タロットカードデザイン (2:3 → --ar 2:3)

テスト変数: **芸術様式**

### C-1: アールヌーヴォー（ミュシャ風）

```
Tarot card design, The Star card, a celestial maiden pouring starlight from two vessels, ornate art nouveau border with gold filigree, purple and midnight blue color palette, intricate decorative frame, Alphonse Mucha inspired style --ar 2:3 --v 7 --draft
```

### C-2: 現代ミニマル

```
Tarot card design, The Star card, a celestial maiden pouring starlight from two vessels, clean minimalist border with geometric patterns, purple and midnight blue color palette, modern flat design with subtle gradients, elegant typography space --ar 2:3 --v 7 --draft
```

### C-3: ゴシック×天文学

```
Tarot card design, The Star card, a celestial maiden pouring starlight from two vessels, gothic astronomical chart border with zodiac symbols, purple and midnight blue color palette, medieval manuscript meets celestial cartography style --ar 2:3 --v 7 --draft
```

---

## D. 背景/UIテクスチャ (16:9 → --ar 16:9)

テスト変数: **密度/雰囲気**

### D-1: 深宇宙（疎）

```
Deep space background texture, scattered constellations and nebulae, subtle purple and dark blue gradient, tiny twinkling stars, minimal and elegant, seamless dark atmosphere for UI background, no text no objects --ar 16:9 --v 7 --draft
```

### D-2: 星座図（中密度）

```
Celestial star chart background texture, constellation lines connecting stars, zodiac wheel faintly visible, purple and indigo tones with gold star accents, mystical astronomical map aesthetic for UI background, no text --ar 16:9 --v 7 --draft
```

### D-3: 魔法陣（高密度）

```
Mystical magic circle background texture, intricate sacred geometry patterns, glowing purple runes and symbols, dark navy base with ethereal purple light emanating from center, ornate occult aesthetic for UI overlay, no text --ar 16:9 --v 7 --draft
```

---

## スコアリングテンプレート（各画像に記入）

| 基準           | 説明                           | スコア (1-5) |
| -------------- | ------------------------------ | ------------ |
| 意図一致度     | プロンプトの意図通りか         |              |
| 美的品質       | 見た目の美しさ・完成度         |              |
| 技術品質       | アーティファクト・崩れがないか |              |
| ブランド適合度 | アストレアの世界観に合うか     |              |
| 使用可能性     | そのまま使えるか               |              |
| **合計**       |                                | **/25**      |

## 学び・メモ

（テスト後に記入）
