// Validate the default Firebase Hosting site before an isolated QA deploy.
// Since 2026-10-15, brand-new Firebase projects may not have a default site yet.
// This is a read-only preflight; it never creates or changes Hosting resources.
import {assertStagingFirebaseConfig} from './staging-config-guard.mjs';

export function getQaDefaultHostingSite(commandResult,projectId){
 assertStagingFirebaseConfig({
  projectId,authDomain:projectId+'.firebaseapp.com',apiKey:'hosting-check-only',appId:'hosting-check-only'
 });
 const payload=typeof commandResult==='string'?JSON.parse(commandResult):commandResult;
 if(!payload||typeof payload!=='object')throw Error('Firebase Hostingの一覧結果が不正です');
 if(payload.status&&payload.status!=='success')throw Error('Firebase Hostingの一覧取得に失敗しました');
 const container=payload.result??payload;
 const sites=Array.isArray(container)?container:
  Array.isArray(container?.sites)?container.sites:
  Array.isArray(container?.results)?container.results:null;
 if(!sites)throw Error('Hostingサイト一覧の形式を確認できません。公開しないでください');
 const matches=sites.filter(item=>{
  if(!item||typeof item!=='object')return false;
  const siteId=item.siteId??item.id??
   (typeof item.name==='string'?item.name.split('/').pop():null);
  return item.type==='DEFAULT_SITE'&&siteId===projectId;
 });
 if(matches.length!==1)
  throw Error('検証専用FirebaseにID「'+projectId+'」のデフォルトHostingサイトがありません。FirebaseコンソールのHostingから、このIDでサイトを作成してください。');
 return matches[0];
}
