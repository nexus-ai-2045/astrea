# Midjourney Prompt Test — アストレア Round 2 (リサーチ反映版)

## 改良ポイント（Round 1からの変更）

- 自然言語文章型に変更（V7は文章理解が強い）
- `--stylize 500` 追加（デフォルト100より芸術性UP）
- `--chaos 40` 追加（4枚のバリエーション幅を広げる探索モード）
- `--no text, watermark, deformed hands` 追加
- アニメ系は `--niji 7` を使用（アニメ専用モデル）
- OGPは右側にテキスト余白を確保する構図指定
- スタイルの幅を大幅拡大（5バリエーション）

---

## A. OGP/シェア画像 (--ar 40:21)

テスト変数: **スタイル** × **構図改善（テキスト余白確保）**

### A-1r: シネマティック（テキスト余白あり）

```
A glowing crystal ball floating above an ancient celestial star chart, positioned on the left side of the frame with empty dark space on the right for text overlay. Deep space background with purple nebulae and golden constellations. Cinematic volumetric lighting with purple and gold rays. Mysterious and inviting atmosphere --ar 40:21 --v 7 --stylize 500 --chaos 20 --no text watermark --draft
```

### A-2r: 浮世絵×コズミック

```
A mystical crystal orb radiating purple energy, resting on an ornate Japanese lacquer stand, left-aligned composition with dark negative space on right. Ukiyo-e woodblock print style meets cosmic art, indigo and gold ink on dark paper, constellation patterns flowing like water. Ethereal and ancient --ar 40:21 --v 7 --stylize 700 --chaos 30 --no text watermark --draft
```

### A-3r: ミニマル×グラデーション

```
A single luminous crystal sphere emanating soft purple light, centered-left with generous dark space around it. Minimal composition, smooth dark purple to black gradient background, tiny scattered stars. Clean and elegant, premium app aesthetic, subtle golden rim light on the crystal --ar 40:21 --v 7 --stylize 300 --chaos 10 --no text watermark busy cluttered --draft
```

---

## B. アストレアのキャラクター (--ar 1:1)

テスト変数: **スタイル幅を5種に拡大**

### B-1r: セミリアル（ゲームCG / Final Fantasy風）

```
Portrait of a mystical Japanese priestess fortune teller named Astrea, elegant and ethereal. Long flowing black hair with subtle purple starlight reflections, wearing layered white and deep purple ceremonial robes. Holding a softly glowing crystal orb. Starry night sky background. Semi-realistic CG art style, soft rim lighting, gentle expression with knowing eyes --ar 1:1 --v 7 --stylize 500 --chaos 30 --no deformed hands extra fingers --draft
```

### B-2r: アニメ（Niji V7）

```
Portrait of Astrea, a beautiful mystical shrine maiden fortune teller. Long flowing dark hair with purple highlights, wearing an ornate white and purple miko-inspired outfit with celestial patterns. Holding a glowing crystal orb. Starry night background with constellations. Gentle mysterious smile, detailed eyes reflecting starlight --ar 1:1 --niji 7 --stylize 400 --chaos 30 --no deformed --draft
```

### B-3r: 水墨画×デジタル融合

```
Portrait of a mystical fortune teller priestess, serene and powerful. East Asian ink wash painting style blended with digital art, flowing black ink strokes forming her hair and robes. Purple and gold watercolor accents for magical elements. Crystal orb glowing with constellation patterns. Minimalist background with ink splatter stars --ar 1:1 --v 7 --stylize 700 --chaos 40 --no deformed realistic photo --draft
```

### B-4r: Vtuber風イラスト

```
Character design sheet of Astrea, a mystical fortune teller Vtuber. Cute yet elegant design, large expressive eyes with star-shaped highlights, long dark purple gradient hair with constellation accessories. Modern miko outfit with purple and gold accents, crystal orb charm. Clean line art, vibrant colors, appealing character design --ar 1:1 --niji 7 --stylize 300 --chaos 20 --no realistic photo --draft
```

### B-5r: 油絵ファンタジー（クラシック）

```
Oil painting portrait of a mystical fortune teller in the style of Pre-Raphaelite art. A beautiful woman with flowing dark hair adorned with tiny stars, wearing flowing purple and white robes. She gazes into a luminous crystal sphere. Rich oil paint textures, dramatic chiaroscuro lighting, gold leaf accents, museum quality fine art --ar 1:1 --v 7 --stylize 800 --chaos 30 --no modern cartoon anime --draft
```

---

## C. タロットカードデザイン (--ar 2:3)

テスト変数: **芸術様式**（タロットMJコミュニティの実績あるプロンプトを参考）

### C-1r: アールヌーヴォー（ミュシャ風）

```
Tarot card illustration of The Star, depicting a celestial maiden pouring starlight from golden vessels into a cosmic river. Ornate Art Nouveau border with flowing organic lines and gold filigree. Color palette of deep purple, midnight blue, and warm gold. Intricate decorative botanical frame inspired by Alphonse Mucha. Mystical and hopeful mood --ar 2:3 --v 7 --stylize 600 --chaos 20 --no text words letters --draft
```

### C-2r: ゴシック×天文学

```
Tarot card illustration of The Star, a robed figure standing beneath a vast star map, surrounded by zodiac symbols and astronomical instruments. Gothic cathedral window frame border with celestial cartography details. Deep purple and navy color palette with gold constellation lines. Medieval illuminated manuscript meets scientific illustration --ar 2:3 --v 7 --stylize 600 --chaos 30 --no text words letters modern --draft
```

### C-3r: 現代イラスト（フラット×グラデーション）

```
Tarot card illustration of The Star, a modern stylized figure reaching toward stars, flowing geometric shapes and gradient orbs. Clean minimalist card border with subtle sacred geometry pattern. Purple to pink gradient palette with gold accents. Contemporary editorial illustration style, elegant and sophisticated --ar 2:3 --v 7 --stylize 400 --chaos 20 --no text words letters realistic photo --draft
```

### C-4r: アニメタロット

```
Tarot card of The Star, a beautiful anime priestess under a canopy of stars, pouring stardust from crystal vessels. Ornate card border with cherry blossom and constellation motifs. Rich purple and gold color scheme. Detailed anime illustration with painterly background --ar 2:3 --niji 7 --stylize 500 --chaos 20 --no text words letters --draft
```

---

## D. 背景/UIテクスチャ (--ar 16:9)

テスト変数: **密度と雰囲気**

### D-1r: 深宇宙（疎・クリーン）

```
Seamless dark space background, scattered tiny stars and faint purple nebulae in the distance. Subtle gradient from deep navy to black. Minimal and elegant, designed as a UI background texture. No objects, no characters, no focal point, just atmosphere --ar 16:9 --v 7 --stylize 200 --chaos 10 --no text objects people bright --draft
```

### D-2r: 星座図（中密度）

```
Dark celestial map background texture, thin golden lines connecting stars into constellation patterns, faint zodiac wheel visible in the center. Purple and indigo tones with subtle gold accents. Mystical astronomical chart aesthetic, designed for UI background use. Even lighting, no bright focal points --ar 16:9 --v 7 --stylize 400 --chaos 20 --no text people bright objects --draft
```

### D-3r: 魔法陣（高密度・装飾的）

```
Intricate sacred geometry circle pattern on a dark background, glowing with soft purple ethereal light. Layered concentric rings with mystical runes, zodiac symbols, and alchemical patterns. Dark navy base with purple light emanating from the center. Ornate occult mandala aesthetic --ar 16:9 --v 7 --stylize 500 --chaos 20 --no text people realistic --draft
```

---

## パラメータガイド

| パラメータ  | Round 2設定             | 理由                                          |
| ----------- | ----------------------- | --------------------------------------------- |
| `--stylize` | 300-800                 | 低め=忠実、高め=芸術的。スタイルで使い分け    |
| `--chaos`   | 10-40                   | Round 1は高め(30-40)で探索。Round 3は低め(10) |
| `--no`      | text watermark deformed | 不要要素排除                                  |
| `--niji 7`  | B-2r, B-4r, C-4r        | アニメ系はNijiモデルが圧倒的                  |
| `--draft`   | 全て                    | Round 1は高速テスト                           |

## スコアリング（各画像に記入）

| 基準           | スコア (1-5) |
| -------------- | ------------ |
| 意図一致度     |              |
| 美的品質       |              |
| ブランド適合度 |              |
| 使用可能性     |              |
| **合計**       | **/20**      |

## PDCA記録

### Round 2 フィードバック

（nexus-ai-2045 のFB後に記入）
