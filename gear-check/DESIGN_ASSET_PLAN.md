# 浜名ヤンキース 道具チェック — 案F 画像刷新指示書

## 目的
既存の `gear-check/` の文字・操作部分は維持し、利用者が承認したカジュアルポップのイラストに置換する。ユニフォームは紺色＋赤パイピング＋白パンツ、帽子は白い独特なマーク。ノックバットは必ず赤色。写真調・手書き記号風にしない。

## ① 作業優先度（確定）
1. ヘッダー（河川敷背景と子どもたち、明るい青空・芝生）／チームキャラクター
2. 河川敷練習・夏に必須の道具18品目
3. 残りの5品目（小さいマーカーコーン、審判道具、スコアラー机、スコアラー椅子、スコップ）
4. 器具庫のラベル装飾・キャラクター補助

## ② パスとファイル名（確定）
- `assets/hero/riverbank.webp`：メイン背景（タイトル一体型素材の場合、画面側で二重に表示しない）
- `assets/mascots/runner.webp`：左上・グローブを持つ子
- `assets/mascots/pointing.webp`：右上・指差す子
- `assets/mascots/cheering.webp`：器具庫1の説明キャラ
- `assets/mascots/store-cheering.webp`：器具庫2の説明キャラ
- `assets/store/storehouse1.svg`, `assets/store/storehouse2.svg`：器具庫見出し
- `assets/items/<道具ID>.webp`：道具アイコン。すべてID単位で個別管理（23ファイル）
- データ内の画像参照：`data/items.json` の `items[].image`

## ③ GitHubの変更対象と内容
- `gear-check/assets/...`：新規画像をアップロード、透過背景の道具アイコンを用意
- `gear-check/data/items.json`：`image` フィールドを対応画像に更新。ID・保管場所・名称・数量は不変。画像更新時は `revision` を更新
- `gear-check/index.html`：ヘッダー画像の読み込みとアクセシビリティ用見出し
- `gear-check/style.css`：ヘッダー、キャラクター、器具庫の見出し、イラスト枠のみ変更。スマホは1列チェックのまま
- `gear-check/app.js`：安全な画像パス・拡張子の検証（SVG/PNG/WebP）、マスターとチェック状況を分離した設計は保持
- `gear-check/sw.js`：新画像、CSS、JSのキャッシュ更新。画像を差し替えても古いキャッシュが残らないようにバージョンアップ
- `gear-check/README.md`：道具単位の差し替え手順と推奨画像サイズ（アイコン：88〜160px / 背景：幅900px程度）を明記

## ④ 安全な反映順
1. mainから `feature/gear-illustration-refresh-20261011` に作業ブランチ作成
2. 画像を追加（旧画像はすぐ消さない）
3. `items.json` / `app.js` / `style.css` / `index.html` / `sw.js` 更新
4. 設定JSONと画像パスが一致するか全23品目確認
5. 河川敷練習（夏）18品目、季節自動切替、練習試合・公式戦の未登録表示、チェック保存を検証
6. `gear-check/` 以外に変更がないことを確認してmainへ反映。GitHub Pagesのデプロイ成功を確認

## 管理者がイラストを替える手順
1. リポジトリに新画像（例：`assets/items/helmet-2027.webp`）をアップロード
2. `data/items.json` の該当道具（例：`id: helmet`）の `image` のみ変更
3. `items.json` の `revision` を変更して保存
4. GitHub Pages公開後、保護者は再読み込みして最新版を取得
5. 道具のIDは変えない（既存のチェックとの対応を守る）

## 注意
- GitHub Pagesは静的な公開サイト。リストやイラストはGitHub書き込み権限を持つ管理者が更新する。保護者のチェック状況は各スマホ保存
- マスター側は一括更新。管理者画面にはGitHub上の編集ページへのリンクを置き、公開アプリに認証トークンを埋め込まない
- 今回の画像刷新の対象は道具チェックアプリのみ。既存のInstagram広報アプリは変更しない
