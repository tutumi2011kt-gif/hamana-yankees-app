// 本番：保護者の×・○を保存後即時共有する（2026-11-19 有効化）。
// Firestore Rules が公開月・入力期間・当番者・同一匿名UIDを必ずサーバー側で検証する。
// 子どもの名前選択だけでは本人確認にならない。管理者が回答の監視・訂正を行うこと。
// 緊急停止時は、GitHubのこのフラグをfalseにし、Firebase Rulesを保存済みの閲覧専用版へ戻す。
export const ANSWER_PUBLICATION_MODE='instant';
export const PARENT_WRITES_ENABLED=true;
export const ACCOUNT_REQUIRED=false;
export const REGISTRATION_REQUIRED=false;
