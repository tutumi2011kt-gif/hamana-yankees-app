## 【重要・2026年11月確認】Firebase新規プロジェクトのHosting初期設定

2026年10月15日以降の新規Firebaseプロジェクトは、**デフォルトHostingサイトをプロジェクト作成時には自動作成しない**仕様になっています。Firebase公式：https://firebase.google.com/docs/hosting/default-site

検証用プロジェクトを作ったら、次の順番で設定してください。

1. Firebase Consoleで、新しい検証専用プロジェクトを作成し、**プロジェクトIDを確認**する（例：`aritama-mini-basket-qa`。既存の本番 `aritama-mini-basket` は使用しない）
2. Hosting画面の「使ってみる／始める」等から、**デフォルトHostingサイトのIDを検証用FirebaseのプロジェクトIDと同じ値**で作成する。既に自動作成されている場合は、ID・既定サイトかどうかだけを確認する
3. 検証用Webアプリを登録し、`authDomain` が `<QAプロジェクトID>.firebaseapp.com` になっていることを確認する。Firebase Consoleで匿名認証・Google認証を有効化する
4. `deploy-qa.mjs` は、配信直前に `firebase hosting:sites:list --project <QA ID> --json` を**読み取り専用で実行**。一致するデフォルトHostingサイトがない場合には公開せず中止する。**サイトを黙って作成することはありません**
5. QAのWebアプリ設定（公開用ID・APIキーなど）で検証版を生成し、架空の12人だけを登録して動作テストする。本番のFirestoreは変更しない

**検証サイトを公開できることと、本番公開の承認は別です。** 自動テスト・スマホ実機試験、権限と個人情報の確認が完了するまで本番公開しない。

## 今回追加：iPhoneから検証用Firebaseを一括点検する画面

- `admin-qa-health.html`：検証専用サイトに組み込まれる管理者向け画面。Googleログイン後、**読み取り専用**でQA初期状態を点検する
- 確認項目：検証プロジェクトID・初期化マーカー、管理者のQA権限、架空名「テスト01〜12」、1月の公開・入力受付、3月の非公開下書き、日ごとの担当者・活動区分
- `qa-readiness-core.mjs` に合否判定を集約。`qa-readiness-tests.mjs` / `qa-health-ui-tests.mjs` で検証し、GitHub Actionsの自動テストに組み込む
- パソコンでは `node firebase-functions/verify-qa.mjs --project <QA_ID>` と実行すると**接続しない確認モード**が動く
- 実際のQAのFirestoreを**読み取りだけ**確認するには、管理者がQAのGoogle UIDとQA IDを二重指定した上で `node firebase-functions/verify-qa.mjs --project <QA_ID> --confirm <QA_ID> --admin-uid <QA側管理者UID> --remote` を使用。QAのApplication Default Credentialsが必要
- `admin-qa-health.html` は、検証用Hosting上で `qa-menu.html` から開ける。現時点では**まだ検証用Firebase・Hosting URLは作成していない**
- この点検の合格はアプリの本番公開許可ではない。iPhone実機操作、匿名認証、複数端末での即時反映、締切を跨ぐ動作は別途確認する

## QA専用デプロイの誤操作防止

- `deploy-qa.mjs` は確認モードが標準で、**Firebaseへの配信を行わない**
- 本番 `aritama-mini-basket` のIDは拒否する。検証専用IDを `--project` と `--confirm` の両方に指定し、明示的に `--apply` を付けた場合だけFirebase CLIを起動する
- 生成済み `dist-staging/firebase-config-staging.mjs` のプロジェクトIDと、配信先のQA IDの一致を確認する
- **管理者がステージング用のFirestoreルール（匿名入力の実験用候補）を承認したときにだけ実行**。本番Firebaseの書込み制限は変更しない
- Windowsでも `node deploy-qa.mjs --project ...` を使用できるようFirebase CLI本体をNode経由で起動する。事前に `npm install --ignore-scripts` が必要
- `staging-deploy-tests.mjs` とGitHub Actionsで、本番ID・不一致・確認省略の場合に配信されないことを自動テスト

## 更新：架空12名の初期データ・安全な登録ツールを追加

- `staging-fixture-core.mjs` に**本番とは無関係の架空名「テスト01〜テスト12」**のデータを用意。本番保護者の個人情報、当番実績、既存の12月・1月データはコピーしない
- 検証用Firebaseには、2027年1月を**公開済みの入力試験用**、2027年3月を**未公開・管理者承認待ち**として作る。1月の練習日には各1人の担当者、練習試合・休みのサンプル各1日を含む。3月は担当者未設定・全日未確認で開始
- `firebase-functions/seed-qa.mjs` は**初期動作がdry-run**。QA環境の管理者認証のFirebase UIDと、QAプロジェクトIDの二重確認を指定しない限りデータを登録しない。QAへの登録は全件を1つのcreate-onlyトランザクションで行い、既存レコードがあれば何も変更せず中止する
- `staging-fixture-tests.mjs` および `staging-fixture-emulator-tests.mjs` で、架空名・曜日・ロック・公開月と未公開月、×○の入力、管理者公開承認まで検証する。**本番Firebaseには接続しない**
- これらは開発ブランチ上の準備。実際の検証用Firebaseプロジェクト／iPhone用URLはまだ作成されていない

### QAプロジェクトができた後の初期化手順（未実行）

1. Firebaseコンソールで**検証専用プロジェクト**を作成し、匿名認証／Google認証／Firestoreを有効化する。実際に使うQAプロジェクトIDを確認する
2. 検証版の管理者画面へGoogleログインし、**QA側Firebase Authentication > Users** に記録された管理者UIDを確認（本番側のUIDを推測・流用しない）
3. QA環境にだけアクセスできるApplication Default Credentials（ADC）を設定する。作業PCでは `cd mini-basket-production && npm install --prefix firebase-functions --ignore-scripts` を実行
4. まず接続しないdry-runでデータの件数を確認：

```sh
node firebase-functions/seed-qa.mjs --project aritama-mini-basket-qa
```

5. 管理者が**QAプロジェクトIDを再確認して承認した場合のみ**、その同じQA IDとFirebase Authenticationの管理者UIDを指定して初期化（以下は**例示・未実行**）：

```sh
node firebase-functions/seed-qa.mjs --project aritama-mini-basket-qa --confirm aritama-mini-basket-qa --admin-uid <QA側で確認したUID> --apply
```

6. 既存データが少しでもあると登録を拒否する。再実行や再初期化で本番・QAの月データを勝手に上書きしない。管理者画面の初回データが揃っていることを確認してから、検証専用Hostingへ進む

# iPhone検証版の準備手順｜本番と完全分離

作成：2026-11-17。**PR #1の開発ブランチ限定。実際の検証用Firebaseプロジェクト、公開URLはまだ未作成。** GitHubの静的コードだけでは実際のクラウド書込みは検証できません。

## 作成したもの
- `staging-config-guard.mjs`：FirebaseプロジェクトID・認証ドメインを検証し、**本番 aritama-mini-basket を接続拒否**。`-staging`、`-qa`、`-test` のいずれかで終わる別プロジェクトだけを許可
- `build-staging-site.mjs`：既存の保護者・管理者用7画面を、同じ検証専用Firebase設定に切り替えたHTMLとして `dist-staging/` に生成。生成元の本番ファイルを書き換えない
- `parent-write-config-staging.mjs`：生成時に検証用だけ `PARENT_WRITES_ENABLED=true`。本番用のフラグは `false` のまま
- `firebase.staging.json`：検証用Firebase HostingとFirestoreの**候補ルール**を指定するファイル。本番で使わない
- `staging-build-tests.mjs`：全7画面の書換えとFirebase本番誤接続防止を自動テスト

## 検証用Firebaseを用意するとき
1. Firebase Consoleで**新しい検証専用プロジェクト**を作成する。命名例は `aritama-mini-basket-qa`。実際の名称は重複しないIDにする。**既存の `aritama-mini-basket` は使わない**。
2. そのプロジェクトでFirestoreとFirebase Authenticationを用意し、`匿名`認証を有効化。管理者画面用のGoogle認証も有効化。検証用ホスティングURLのドメインを承認済みドメインに設定する。
3. 検証用のWebアプリを登録して、そのプロジェクトの `apiKey`、`authDomain`、`projectId`、`appId` 等の**Web設定値**を取得する。秘密のサービスアカウント鍵は不要で、Webページへ混入させない。
4. 本番の12人の実データをコピーしない。架空名の12人と、公開済み2027年1月の仮練習日・テスト用×○を別プロジェクトに登録する。管理者Google UIDにだけ `admins/{uid}.enabled=true` を作成し、ほかのメンバー情報・公開用名簿と月の状態を揃える。
5. 開発用マシン・Work等で、環境変数 `STAGING_FIREBASE_CONFIG_JSON` を設定し `node build-staging-site.mjs` を実行する。生成後、`dist-staging/index.html` が検証用保護者ページ、`qa-menu.html` が検証用の各管理者画面へのリンクになる。
6. **検証環境でのみ**、管理者がルール・テスト結果とプロジェクトIDを確認し、`node deploy-qa.mjs --project <検証QAプロジェクトID> --confirm <同じQAプロジェクトID> --apply` で配置する（**まだ実行しない**）。通常の`firebase deploy`ではなく、この二重確認・本番拒否チェック付きツールを使う。
7. 発行された **検証用URL** をまず管理者のiPhoneで確認。保護者2〜3人へは検証用途であることを明記した後に限定共有。検証URLは外部SNSに一般公開しない。
8. QAの詳細は `SMARTPHONE_QA_PLAN.md` を参照。通過後も**本番Firebaseへの反映は別途管理者承認が必要**。

### ビルド例（検証環境用設定が取得できた後）
```sh
cd mini-basket-production
# 例示のみ。必ず「新しく作った検証専用Firebase」の値に置き換える。
export STAGING_FIREBASE_CONFIG_JSON='{"projectId":"aritama-mini-basket-qa","authDomain":"aritama-mini-basket-qa.firebaseapp.com","apiKey":"STAGING_WEB_KEY","appId":"STAGING_WEB_APP_ID"}'
node build-staging-site.mjs
```

`dist-staging/` はビルド生成物。検証用Webアプリの公開IDを含みますが、秘密鍵を含めないこと。**本番Firebaseの `firebase-config.mjs` は検証サイトにコピーしない**こと。

## 注意
- このツールは**サイトのファイルを生成するだけ**で、Firebaseへの接続やデプロイをしない
- 検証用Web設定が未設定ならビルドを拒否。IDが `aritama-mini-basket` なら拒否する
- Firestore匿名UIDで名前選択本人認証はできない（A方式の既知リスク）。監査と管理者訂正は本人認証を代替しない
- ホスティング・認証・Cloud Functionsなどの費用、プロジェクト権限、Firebase認証の許可ドメインは検証環境作成時に確認する
- 月初の定期自動作成Cloud Functionsは検証環境でも別途デプロイが必要だが、この手順ではまだ配信しない
- **本番の `firebase.json` は引き続き `firestore-parent-readonly.rules` のまま**。2026年12月確定表と2027年1月下書きは編集しない
