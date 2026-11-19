// A方式：保護者の回答は送信後に即時共有。ユーザーの確定仕様。
// 注意：この設定は本番反映前の候補ブランチ専用。QAと本番のルール検証・承認が済むまでmainへマージしない。
// trueにしてもFirebase側ルールで許可されなければ保存できません。
// 名前選択は本人認証ではないため、運用責任者による入力監視・訂正・緊急停止体制の確認が必要です。
export const ANSWER_PUBLICATION_MODE='instant';
export const PARENT_WRITES_ENABLED=true;
export const ACCOUNT_REQUIRED=false;
export const REGISTRATION_REQUIRED=false;
