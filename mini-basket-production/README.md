# ミニバス当番管理 本番準備（2026年11月15日）

## 実装済み
- index.html と app.mjs：スマホ用の名前選択・月選択・×／○入力画面
- core.mjs：月初ロック、曜日条件、希望禁止、7日経過通知判定、ファクトチェック
- firebase-client.mjs：Firestoreのリアルタイム監視と回答1件単位の保存（接続後に有効）
- firebase-config.mjs：専用Firebase Webアプリ接続設定を反映済み。Authentication（匿名＋Google）、Firestoreを管理者が有効化済み
- firestore-bootstrap.rules：現在の管理者限定ルールの初期版（ユーザーによる公開済み）。Firestore Rulesの実際の公開履歴も確認すること
- firestore.rules：保護者向け×・○のアクセス制御案。**未公開・エミュレータテスト前につき使用禁止**
- core-tests.mjs：割当・締切・交代候補の単体テスト

## 管理者：2027年1月の仮当番表編集（追加）

- manage-january.html：管理者のGoogleログイン後にFirestoreから名簿を読み込み、2027年1月の水・金・土・日計19日について「練習予定／試合／休み」と担当者を手動設定する。試合・休みは担当なし
- month-draft-core.mjs：月の曜日生成・担当者の対象期間・未入力や曜日条件違反の警告を判定
- **未確定の試合日や担当者を推測しない**ため、初期画面は全19日を仮の練習予定・担当者空欄で表示する
- Firebaseへの保存は管理者が確認してから。月の publication='draft', inputState='closed', scheduleStatus='awaiting-manager' として記録する
- 既存の公開済みの月・不整合なデータ・別端末による更新を検出した場合は保存を拒否する。12月の確定当番表は一切変更しない
- **2027年1月はまだ保護者へ公開しない**。管理者承認・入力締切の確認・Firestoreルールの結合テストが残っている
- 管理者用下書きのロジックテスト9件と画面JavaScript構文テストは成功。Firebase本番への実際の書き込みはユーザーが画面で実行するまで未実施

## 保護者の×・○入力機能（2026/11/15 実装、公開前）

- parent.html：カレンダーの日付を直接タップし、×または○を選ぶUIとFirestoreトランザクション書き込みを追加。元担当者名は固定し、交代○は候補として表示し、自動割当しない。
- parent-input-core.mjs：公開状態・openAt/cutoffAt・担当者本人×/他の人○・自分の登録した回答の取消などの純粋関数
- parent-input-tests.mjs：25ケースの単体テストは成功。現時点でFirestore Rules Emulatorでの結合テストは**未実施**
- firestore-parent-write-candidate.rules：**候補ファイル・未公開**。締切はサーバーrequest.time、回答の編集取消は匿名UID一致、休み・試合・未割当には×○不可。ルールエミュレータによる許可／拒否試験完了前に公開してはいけない
- 現在公開している firestore-parent-readonly.rules では保護者に書き込み権限はない。12月は確定済み・締切済みのため、ユーザー画面で×・○は押せない
- 「名前を選ぶだけ」は本人確認にならない。匿名UIDの異なる端末で回答を消すことはできず管理者修正が必要になる。**この制約への運用上の同意・対策が必要**
- 2027年1月以降は実際の練習日・試合日・担当者・回答期間を管理者が決め、確認して公開する。未確認条件を推測して仮割当しない

## 保護者への安全な閲覧公開（2026/11/15追加）

- publish-roster.html：管理者がメンバー原本から **ID・名前・よみがな・在籍状態のみ**をFirestoreの public/roster に保存する。初期構築で公開確認された2026-12を publishedMonths に含める
- parent.html：保護者用の閲覧専用カレンダー。匿名Firebase認証、public/roster・公開月の月情報・days・answersだけを onSnapshot で購読する
- firestore-parent-readonly.rules：**未公開のルール案**。Firestoreルールに管理者本人が貼り付けて「公開」を押すまでは保護者は閲覧できない
- 管理者の manage-members.html は、公開用名簿が作られた後はメンバー編集時に public/roster も同じFirestoreトランザクションで同期する
- 12月は confirmed/published/closed で閲覧専用。**保護者の×・○保存はこの段階では無効**。今後の入力対象月が管理者承認済みになるまで×・○の書き込みは許可しない
- 将来1月・2月を公開するときは、管理者承認後に public/roster.publishedMonths の更新も必要
- **重要なプライバシー上の制約**：匿名認証は保護者本人を識別せず、共通URLの外部流出・公開リポジトリの静的ファイルなどにより第三者が情報を見られる可能性がある。公開前にチームで共有範囲を確認する。App Checkも本人確認とは異なる
- 実行済みテストはJavaScript構文チェックと既存ロジックの単体テストのみ。実際のルールのエミュレータテスト・匿名閲覧・管理者編集の動作検証は**未実施**

## 2026年12月の確定当番表（初期登録の準備）

- december-2026.mjs：当番15日、試合2日（12/26・12/27）、12/9村松さわは当番教習（回数除外）
- setup-december.html：管理者本人が全日付を確認し、既存データがない場合だけFirestoreへ一括保存する専用画面
- 本番Firestoreへの保存は**画面で本人が確認して「登録」した場合だけ**行われる。GitHubにファイルを作るだけではFirestoreには反映されない
- 入力は confirmed/published/closed（12月は締切済み）。保護者用の匿名書き込みは現在の管理者限定ルールで禁止されている
- 以前の別デモにある架空の日付割当を絶対に初期登録しない
- 2027年1月・2月などは確定日付・個別の曜日希望が未確認のため勝手に本番登録しない

## Firebaseのデータ構造
- teams/aritama-mini-basket/members/{memberId}：name, kana, grade, days, startDate, endDate, status
- teams/aritama-mini-basket/months/{YYYY-MM}：publication, inputState, openAt, cutoffAt
- teams/aritama-mini-basket/months/{month}/days/{YYYY-MM-DD}：type, ownerId
- teams/aritama-mini-basket/months/{month}/answers/{date_memberId}：date, memberId, kind(x/o), updatedBy, updatedAt
- teams/aritama-mini-basket/private/：管理者限定回数データ
- teams/aritama-mini-basket/audit/：将来サーバー側で操作履歴を記録
- admins/{googleUid}：認証済み管理者の許可

## 本番接続前に必要な作業
1. 野球の道具アプリとは独立したFirebaseプロジェクトを作る
2. Authenticationで保護者用匿名認証と管理者用Googleログインを有効化する
3. メンバー・月・練習日データを投入する。管理者が曜日条件を確認する
4. Firestore Rulesをエミュレータで検証し、管理者限定操作・月初ロック・回答の制限を確認する
5. ルールをデプロイしてWebアプリの設定をfirebase-config.mjsに登録する
6. App Checkや課金アラートも設定し、2台→15台のスマホで同期を確認する
7. 月初自動作成・7日未解決メールは安全なサーバー処理として別途実装・検証する

## 注意点
- 旧 index.html は試作画面。新 parent.html はFirebaseのクラウド閲覧用だが、管理者がセキュリティルールを公開するまでは保護者が見られない。×・○の本番保存はまだ無効
- 名前選択のみでは本人認証にならず、他人の名前で入力できる可能性がある。管理者のアクセス権は別に保護する
- 端末がオフライン・クラウド接続に失敗した場合、保存済みと表示してはならない
- 締切は端末時計に頼らずFirestoreのサーバー時刻で強制する
- 退団・終了日は推測せず管理者が設定する。はるかは曜日制限なし。ゆいは初期仮当番の水曜日のみ
- 未確認の曜日希望が残る場合、確定処理を禁止する
- 自発的な○の交代協力には通常割当の曜日制限を適用しない
- 年次引き継ぎはスマホの管理画面だけで完結する設計とし、GitHub/Firebaseの技術管理権限は2人以上が保持する

## 確認用URL
https://tutumi2011kt-gif.github.io/hamana-yankees-app/mini-basket-production/
