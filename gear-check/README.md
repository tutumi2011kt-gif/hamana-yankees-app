# 浜名ヤンキース 道具チェック（カジュアルポップ版）

公開URL: https://tutumi2011kt-gif.github.io/hamana-yankees-app/gear-check/

## 基本操作
- 一番上で「練習試合」「公式戦」「河川敷練習」を選びます。
- 4〜10月は夏、11〜3月は冬を自動選択。「夏仕様」「冬仕様」から手動指定でき、「自動設定に戻す」で戻れます。
- 器具庫1と器具庫2の道具を、器具庫から出したらタップしてチェックします。
- チェック状況は、そのスマホのブラウザに当日・活動・季節別に保存します。**保護者間ではチェックを共有しません。**
- 前のバージョンの同じブラウザにあったチェック状態は可能な範囲で引き継ぎます。
- 練習試合・公式戦は持ち物が未確定のためリスト未登録。河川敷練習（冬）も仮設定で、テント2つ。

## ファイル構造
- `index.html`：HTML。タイトルと読み込み
- `style.css`：案Fカジュアルポップの画面デザイン
- `app.js`：活動切替・季節切替・チェック保存・共有ファイルの読込
- `data/items.json`：全道具のID・名称・保管場所・数量・画像のパス
- `data/lists.json`：活動・季節ごとの道具ID一覧と注意文
- `assets/hero/riverbank.webp`：承認済み案Fのヘッダー（河川敷・子ども・タイトルをまとめた画像）
- `assets/mascots/*.webp`：子どもキャラクター（個別差し替え可能）
- `assets/store/*.webp`：器具庫1・2の見出しイラスト
- `assets/items/〈道具ID〉.webp`：道具ごとに独立したイラスト（23種類）
- `assets/items/flagpole.svg`, `flagpole_support.svg`：団旗の棒と支える棒の仮イラスト
- `sw.js`：オフライン閲覧用キャッシュ

## 道具を追加する
1. GitHubで `data/items.json` を開き、「Edit this file」（鉛筆）からJSONの `items` 配列に道具を追記します。
2. `id` は半角英数字・ハイフン・アンダースコアのみ、既存と重複不可。 `name` は表示名、 `store` は1または2、 `qty` は通常数量です。
3. `image` は `./assets/items/xxx.svg` のような、画像の相対パスを入れます。最初は既存の画像を仮使用しても構いません。
4. `data/lists.json` の該当プロフィール（例： `river-summer` ）に追加したIDを追記します。
5. 「Commit changes」で保存。GitHub Pagesの公開が終われば、全員のアプリに反映されます。

## 道具のイラストを変更する
1. イラストを用意します。**SVGか背景透明PNG**がおすすめ。写真をそのまま使うより、背景透明のイラストが馴染みます。
2. GitHubの `assets/items/` に新しい画像をアップロードします。画像ごとに別ファイルなので、ヘルメットだけ・ボールかごだけを変更できます。
3. `data/items.json` の該当 `image` を新しいファイル名に変更します（画像を同じファイル名で差し替えることも可能）。WebPも利用できます。
4. **重要：** `items.json` 上部の `revision` も新しい値に変更してください（例： `2026-10-12-1` ）。ブラウザが古い画像を保持するのを防ぎます。
5. 保存後にGitHub Pagesが公開されるのを待ち、スマホでアプリを再表示して確認します。

## 活動・季節の道具を変更する
- `data/lists.json` の `profiles` 内には `river-summer`, `river-winter`, `practice-summer`, `practice-winter`, `official-summer`, `official-winter` の6種類が入っています。
- 各配列に、 `items.json` に登録済みの `id` を並べます。器具庫1→2の順に自動で表示します。
- 冬のテントは `items.json` の `seasonQty` で `2つ` に指定してあります。
- `lists.json` の `notes` は、未確定などの注意文です。設定が完了したら注意文を空文字にできます。

## 公開・安全上の注意
- GitHub Pagesは公開サイトです。選手の個人情報・連絡先・位置情報などの非公開情報は載せないでください。
- 一般の保護者はチェックだけ。画面最下部の管理者向け設定には公開GitHubへのリンクがありますが、**GitHubへの書き込み権限がある人だけが更新できます**。
- 管理者変更が全員に反映されるのはGitHub Pagesの公開後です。すでに開きっぱなしの画面は自動更新されず、再表示や再読み込みで最新情報を取得します。
- 通信断時は最後に読み込んだ共有データを表示できる場合があります。初回アクセスは通信が必要です。
- GitHub上の `data/` ファイルを更新しても、既存の `localStorage` に保存された道具リストで上書きされることはありません。
- 道具IDを変更すると保存済みのチェックとは結びつかなくなるため、原則としてIDは変えないでください。

### 運用上の推奨
GitHubで編集したら、リストと画像を別のスマホで確認してから保護者へ周知してください。

## 案F イラスト刷新（準備中）
画像の優先順位・命名・導入手順は [DESIGN_ASSET_PLAN.md](./DESIGN_ASSET_PLAN.md) を参照。`assets/hero/riverbank.webp`、`assets/mascots/*.webp`、`assets/items/<ID>.webp` をアップロードする。**画像がすべて登録されるまでこのブランチをmainにマージしない**。画像の新旧を混在させないため、全23品目の画像存在・表示・キャッシュ更新を確認する。

案Fの倉庫イラスト `assets/store/storehouse1.webp`/`storehouse2.webp` と、キャラクター4枚 `assets/mascots/*.webp` は画像一式に同梱。キャラクターの画像ファイルは単体で変更可能です。

## 2026年10月 イラスト差し替え作業
- 素材画像は `gear-check/assets/hero/`, `gear-check/assets/mascots/`, `gear-check/assets/store/`, `gear-check/assets/items/` に配置。
- `gear-check/items/`、`gear-check/mascots/`、`gear-check/store/` に誤ってアップロードされた画像は正しい `assets/` に移動済み。
- フラッグポール2種類を含む全25道具が登録され、河川敷練習（夏・冬）は各20道具。公式戦・練習試合のリストは未設定。
- ヘッダー画像はタイトルを含むため、同じタイトルを画面上に重ねて表示しません。見出しはスクリーンリーダー用にHTML内に残しています。

## 2026-10-12 イラスト7点の更新
ボールかご（黒いバッグ）、置きT用ボールかご（黄色・ボール入り）、折り畳みボールかご（青い空コンテナ）、メジャー（大）（黄色の枠・白い巻尺）、テント（緑屋根）、工具箱（青紫）、長椅子（黒座面）の画像を、`assets/items/〈道具ID〉-20261012.webp` に更新しました。画像は各アイテム独立で変更可能です。既存の旧画像もバックアップとして維持しています。変更時には items.json の image と revision を更新します。


## Firebase sync (phase 1: safe connection, 2026-10-12)
- The app remains on GitHub Pages; parents use the same URL and no login.
- cloud.js uses Firebase CDN Web SDK. On Firestore document gearCheck/config, it can receive mode + seasonal profile updates in real time, falling back to the GitHub JSON if Firebase is unavailable/empty/locked.
- Firebase project: hamana-yankees-gear-check. Public web config is not a server credential; actual read/write permissions depend on Firebase rules.
- Next configuration steps:
  1. In Firebase Authentication > Settings > Authorized domains, add tutumi2011kt-gif.github.io.
  2. Open the GitHub Pages app > 管理者向け設定 > Googleでログイン; copy the UID.
  3. In Firebase Firestore > ルール, replace __ADMIN_UID__ in gear-check/firestore.rules with that UID and publish.
  4. Phase 2: app-based editor and first initialization of gearCheck/config. Until then the ② link to GitHub remains as before.
- firestore.rules in this repository is a TEMPLATE and is not deployed automatically.
