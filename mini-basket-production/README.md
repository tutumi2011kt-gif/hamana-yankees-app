# ミニバス当番管理 本番準備（2026年11月15日）

## 実装済み
- index.html と app.mjs：スマホ用の名前選択・月選択・×／○入力画面
- core.mjs：月初ロック、曜日条件、希望禁止、7日経過通知判定、ファクトチェック
- firebase-client.mjs：Firestoreのリアルタイム監視と回答1件単位の保存（接続後に有効）
- firebase-config.mjs：null。現時点でFirebaseには未接続
- firestore.rules：未デプロイのアクセス制御案。エミュレータテストが必要
- core-tests.mjs：割当・締切・交代候補の単体テスト

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
- 現在のGitHub Pages画面は本番運用ではない。端末内試作だけで、15人のデータ同期は未稼働
- 名前選択のみでは本人認証にならず、他人の名前で入力できる可能性がある。管理者のアクセス権は別に保護する
- 端末がオフライン・クラウド接続に失敗した場合、保存済みと表示してはならない
- 締切は端末時計に頼らずFirestoreのサーバー時刻で強制する
- 退団・終了日は推測せず管理者が設定する。はるかは曜日制限なし。ゆいは初期仮当番の水曜日のみ
- 未確認の曜日希望が残る場合、確定処理を禁止する
- 自発的な○の交代協力には通常割当の曜日制限を適用しない
- 年次引き継ぎはスマホの管理画面だけで完結する設計とし、GitHub/Firebaseの技術管理権限は2人以上が保持する

## 確認用URL
https://tutumi2011kt-gif.github.io/hamana-yankees-app/mini-basket-production/
