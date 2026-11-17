// A方式：保護者の回答は送信後に即時共有。ユーザーの確定仕様。
// 公開前の安全ゲート：本番のFirestoreルールが閲覧専用のためfalseを維持する。
// 本番での有効化は匿名書込みルールの本番承認・デプロイ・実機検証後のみ。
// このフラグをtrueにするだけではFirebaseの書込み権限は得られない。
export const ANSWER_PUBLICATION_MODE='instant';
export const PARENT_WRITES_ENABLED=false;
export const ACCOUNT_REQUIRED=false;
export const REGISTRATION_REQUIRED=false;
