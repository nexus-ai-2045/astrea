<!-- repo-preflight:review-record -->

# 公開準備状況

- HEAD: `feat/harden-public-endpoints`
- 確認日時: `2026-08-07`
- 判定: `blocked`（残るのは履歴の個人パス 1 件のみ。下記「残余リスク」）

## 確認済み

- [x] README / LICENSE / SECURITY.md / CONTRIBUTING.md
- [x] test / build / lint / smoke / E2E
  - `npm test` 252 passed / 16 files
  - `npx tsc --noEmit` OK
  - `npm run build` 成功
  - **実 `claude -p` での通し確認 (bridge なし / 本番構成)**:
    出迎え 0.1s (LLM 不使用) → 命式 6.3s → 展開法+札 6.9s → 本鑑定 16.5s。
    本鑑定の 4 見出しすべて出力。モデルは展開法を 3 つ名前で提示し、
    位置 (状況/障害/助言) を守って読んだ
- [x] secret / PII / personal path / history
  - `secret_scan` pass
  - **personal_path_scan fail** — 下の「残余リスク」参照
- [x] dependency / license / CI workflow security
  - `npm audit` **0 vulnerabilities** (next 16.2.6 → 16.3.0 で high 4 件を解消)
  - CI: `.github/workflows/ci.yml`。トリガーは push / pull_request のみ、
    `permissions: contents: read`。`issue_comment` / `pull_request_target` は
    public repo で第三者が特権実行できるので入れていない
- [x] operations / monitoring / rollback
  - レート制限は四層 (IP 窓 20/10分・IP 日次 60・セッション 40・全体日次 500)
  - 出迎えは LLM を呼ばないので、セッション開始の連打で予算を削れない
  - 監視・アラートは未整備（残タスク）
- [x] project登録 / GitHub owner / author identity policy
  - owner: `nexus-ai-2045`
  - commit identity: **個人名義の commit は 0 件**。63 commit 中 62 が
    author/committer とも `nexus_ai`、残る 1 は GitHub Web UI の merge で
    committer が `GitHub <noreply@github.com>`（個人情報ではない）
  - 公開物の名義は nexus_ai のみ。LICENSE 等の内容にも個人名を入れない
  - **ただし commit メッセージに旧アカウント名が 1 件残る** — 下の残余リスク

## 人間目視

- reviewer:
- reviewed_at:
- exact HEAD / PR diff:
- reviewed content:
- decision: `approve / changes_requested`
- 外から見えるfilesとcommit history:
- review済み:
- 未review:
- 残余リスク:
  - 2026-08-07 のセキュリティ監査で出た 3 件は修正済み。
    - HIGH: 自己申告スコアで自分の文言を他人のプロンプトへ混入できた
      → 再利用は運用者が明示的に許可したセッションのみ (`sessions.rag_approved`)。
        許可する HTTP 経路は無く、既定では 1 件も許可されていない
    - MEDIUM: 1 IP が全体の日次予算を単独で枯らせた
      → 出迎えを LLM 非使用にし、IP あたりの日次上限を追加。
        25 IP から出迎え 25 回を投げて日次予算の消費が 0 であることを実測
    - LOW: 保存の告知が無かった → 開始画面に明示
  - **git 履歴に個人を特定できる情報が 2 種類残っている。**
    どちらも現在の tree には無く、`origin/main` の履歴にのみ存在する。
    1. 個人の実名を含む絶対パス（`/Users/<実名>/...`）
       — `scripts/mj-*.py` 7 ファイル / 43 commit
    2. 旧 GitHub アカウント名を含む commit メッセージ
       — `aea85df` の "Merge pull request #1 from <旧アカウント>/..." 1 件
    現状 repo は PRIVATE / fork 0 / star 0 のため公開露出はゼロ。
  - 履歴書き換え (filter-repo + force push) では GitHub 上の orphan commit が
    SHA 直打ちで到達可能なまま残るため、**公開の解決策にならない**。
  - 方針 (2026-08-07 決定): この repo は private のまま開発用として使う。
    public 化するときは履歴を持たない新 repo に現在の tree だけを載せる。
- 次に承認する正確な操作:
  - branch `feat/harden-public-endpoints` の push と PR 作成まで（実施済み）。
  - merge と public 化は別承認。

## public 化の実行記録（2026-08-07）

**公開先 repo を作成し、履歴なしの内容を push した。visibility はまだ PRIVATE。**

- 公開先: `nexus-ai-2045/astrea`（この repo は開発用として private のまま残す）
- 公開した commit: `138cbf45` / 1 commit / 89 ファイル
- **GitHub 上の tree SHA = レビュー済み HEAD の tree SHA**（`2aac6dc0…`）で一致。
  公開される内容が CI が検証したものと 1 bit も違わない
- GitHub 上の commit メッセージ・名義に旧痕跡 0 件（API で実測）
- 新 repo でも CI が success

残るのは **visibility を public にする操作だけ**。これは不可逆なので CEO が行う。

### 公開 repo を更新するとき

force push は使わない。既存 commit を親にした commit を作れば fast-forward で通る。

```bash
NEW=$(git commit-tree "$(git rev-parse 'HEAD^{tree}')" -p <公開先の現 main> -m "message")
git branch -f publish-clean "$NEW"
git push astrea publish-clean:main
```

こうすると公開 repo は自前のきれいな履歴を積んでいく（開発 repo の履歴は入らない）。

## public 化の手順（2026-08-07 リハーサル済み → 実行済み）

履歴を捨てて現 tree だけを新 repo に載せる。**この手順は実測で検証してある**
（下の「検証結果」）。既存 repo は private のまま開発用に残す。

### 手順

```bash
# 1. PR をマージして main を最新にする（CEO のブラウザ操作）
git switch main && git pull

# 2. 親を持たない commit を 1 個作る。tree はそのままなので中身は変わらない
CLEAN=$(git commit-tree "$(git rev-parse 'HEAD^{tree}')" -m "initial commit")

# 3. 中身が main と同一であることを確認する（ここが要）
test "$(git rev-parse "${CLEAN}^{tree}")" = "$(git rev-parse 'HEAD^{tree}')" \
  && echo "OK: 公開する中身はレビュー済み main と同一"

# 4. 痕跡が消えたことを確認する
git log --format='%s%n%b%n%an <%ae>%n%cn <%ce>' "$CLEAN"   # 1 commit ぶんだけ
git grep -liI -E '<旧アカウント名>|<実名>' "$CLEAN" -- .   # 0 件であること

# 5. 新 repo を作り（private で作成 → 確認 → public へ）、push する
#    push 後に GitHub 上でも履歴が 1 commit であることを目で見る
```

`git filter-repo` は使わない。書き換えても GitHub 側に orphan commit が残り、
40 桁 SHA を直打ちすれば読めてしまうため（過去に実測済み）。

### なぜ `git commit-tree` か

`git init` + コピーだと改行コードや file mode の差で中身が変わり得る。
`commit-tree` は既存の tree オブジェクトをそのまま指すので、**tree hash が
一致することをもって「レビューした内容と 1 bit も違わない」と言える**。

### 検証結果（2026-08-07 / HEAD 5483571 で実施）

| 項目 | 現 repo | clean commit |
|---|---|---|
| commit 数 | 63 | **1** |
| tree hash | `049fa519…` | **`049fa519…`（一致）** |
| commit メッセージ中の旧アカウント名 | 1 件 | **0 件** |
| file 内容の実名 | 43 commit に存在 | **0 件** |
| author / committer | nexus_ai（+ Web merge 1 件） | **nexus_ai のみ** |

リハーサルで作った commit は branch から参照していないので gc で回収される。
repo も remote も作っていない。

### 公開前に目で見ておくもの

- `mj-prompt-log.md` / `mj-prompt-log-r2.md` — ビジュアル素材の Midjourney
  プロンプト記録。PII も secret も無いが、公開したい内容かは人の判断
- 全 89 ファイル。`git ls-tree -r --name-only HEAD` で一覧できる
