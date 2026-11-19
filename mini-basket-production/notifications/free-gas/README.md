# 🏀 無料Gmail通知設定（Firebase Sparkのまま）

**対象プロジェクト**：`aritama-mini-basket`
**通知先**：`tutumi2011kt@gmail.com`
**方式**：Apps Scriptが15分おきにFirestoreの保護者回答を読み、前回からの**登録・変更・取消**をメールで通知。

> Gmailの送信元は設定者本人のアカウントです。Firebaseの有料プラン、SMTPパスワード、Cloud Functions、一般公開のWebアプリは不要です。
> Apps ScriptとFirebaseそれぞれの無料枠を超えない範囲で使ってください。

## 利用開始（PCでの設定がおすすめ）

1. [Google Apps Scriptを新規作成](https://script.google.com/home/projects/create)し、**Firebase本番プロジェクトの管理権限があるGoogleアカウント**でログインします。
2. 初期の`コード.gs`に、同じフォルダーの [Code.gs](./Code.gs) の**全文**をコピーして貼り付け、保存します。
3. Apps Scriptの**プロジェクトの設定**で「appsscript.json マニフェスト ファイルをエディタで表示する」を有効にします。
4. エディタで`appsscript.json`を選び、[同名ファイル](./appsscript.json) の内容で置き換え、保存します。Googleアカウント自身によるFirestoreの読み取りとメール送信に必要な権限を明示します。
5. 関数選択から `testFreeBasketMail` を実行し、Googleの権限許可に進みます。**管理用Gmailにテストメールが届くことを確認**してください。
6. 関数選択から `setupFreeBasketMail` を**1回だけ実行**。既存回答を初回状態として保存し、15分ごとのタイマーが設定されます。この時点で**既存回答のメールは送りません**。
7. 本番保護者アプリで「日付選択→確認画面→確定登録」を試し、その後の定期照合でGmailに変更通知が届くことを確認します。テスト回答は後で取り消し、その取消メールも確認します。
8. Apps Scriptの左側「トリガー」に`pollBasketChanges`が15分間隔で1つだけ存在することを確認します。

**重要**：`setupFreeBasketMail`が成功するまでは本番アプリで「自動メール送信済み」と表示してはいけません。実際のメール到着後、保護者向けの文言を「管理者への通知は最大約15分後」などに更新してください。

## 特徴・限界

- このスクリプトは**Firestoreへの書込み権限を使いません**。閲覧し、Gmailを送信するだけです。
- **メールに子どもの名前・日付・×○・登録／変更／取消を記載**します。
- メールは確認操作ごとではなく、**15分おきに観測した差分のまとめ**です。同じ期間中に複数人が変更した場合は一通にまとまる場合があります。
- 「登録→すぐ取り消し」を15分間隔の間に行うと、最終状態が元に戻るため**通知が残らない可能性**があります。すべての操作履歴が必要なら、サーバー側の変更履歴設計が別途必要です。
- 別端末の匿名ユーザーは他人の既存回答を変更できない制御がありますが、**子どもの名前選択は本人確認ではありません**。管理者が内容を点検してください。
- 一定時間内に更新が行われてもメールの到着はGoogleのトリガー・Gmail処理の混雑で前後することがあります。即時通知保証はありません。
- FirestoreのSpark無料枠は読み取り1日50,000件。15分間隔でも回答数が多い場合は枠を圧迫するので、Firebase Consoleで利用量を確認してください。
- Gmail個人向けApps Scriptの送信先上限は通常100人/日。通知先が1人なので通常のミニバス運用なら収まると考えられますが、保証はありません。
- 実行ユーザーにFirestoreデータの読み取りIAM権限が必要です。403エラーならFirebaseプロジェクトと同じ管理用Googleアカウントか確認してください。
- **スクリプトは共有・公開しないでください。** Googleアカウントの権限で本番Firestoreを読み取ります。メール本文を含む通知運用についてチーム内で合意しておくと安心です。

## 停止

Apps Scriptの`stopFreeBasketMail`を手動実行すると、定期トリガーだけ削除します。Firebaseの当番表・回答は一切変更しません。

## 公式仕様

- https://firebase.google.com/docs/firestore/use-rest-api
- https://developers.google.com/apps-script/guides/triggers/installable
- https://developers.google.com/apps-script/guides/services/quotas
- https://firebase.google.com/docs/firestore/quotas
