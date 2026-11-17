// Staging-only safety check used before initializeApp on every test page.
// A Firebase web API key is not a secret, but project identity must be isolated.
// The guard is a safety net, not proof that a malicious account cannot connect.
export const PRODUCTION_FIREBASE_PROJECT_ID = 'aritama-mini-basket';
const SAFE_STAGE_SUFFIX=/(?:-staging|-qa|-test)(?:-[a-z0-9]+)?$/;
export function assertStagingFirebaseConfig(config) {
 if (!config || typeof config!=='object') throw new Error('検証版Firebaseの設定がありません');
 const id=config.projectId,auth=config.authDomain;
 if(typeof id==='string'&&!/^[a-z][a-z0-9-]{4,29}$/.test(id))throw new Error('Firebase検証用プロジェクトIDの形式が不正です');
 if(typeof id!=='string'||!id||id===PRODUCTION_FIREBASE_PROJECT_ID
   ||!SAFE_STAGE_SUFFIX.test(id))throw new Error('安全のため、検証専用Firebaseプロジェクト以外は接続できません');
 if(typeof auth!=='string'||auth!==id+'.firebaseapp.com')
   throw new Error('Firebaseの認証ドメインが検証用プロジェクトと一致しません');
 if(typeof config.apiKey!=='string'||!config.apiKey.trim()
   ||typeof config.appId!=='string'||!config.appId.trim())
   throw new Error('Firebase検証用Webアプリ設定が不足しています');
 if(config.storageBucket && typeof config.storageBucket==='string'&&
   ![id+'.firebasestorage.app',id+'.appspot.com'].includes(config.storageBucket))
   throw new Error('ストレージ設定が検証専用プロジェクトと一致しません');
 return id;
}
export function parseAndCheckStagingFirebaseConfig(json) {
 let config;
 try{config=typeof json==='string'?JSON.parse(json):json;}catch{throw new Error('Firebase検証用設定のJSONが不正です');}
 assertStagingFirebaseConfig(config);
 return Object.freeze({...config});
}
