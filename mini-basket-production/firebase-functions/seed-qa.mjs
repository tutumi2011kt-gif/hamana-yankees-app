// Fictitious data seeding for a newly created QA Firebase project ONLY.
// Default mode is dry-run; zero remote reads/writes unless --apply.
// Usage (from mini-basket-production):
//   node firebase-functions/seed-qa.mjs --project my-basket-qa
//   node firebase-functions/seed-qa.mjs --project my-basket-qa --confirm my-basket-qa --admin-uid FIREBASE_GOOGLE_UID --apply
// Requires Firebase Admin application-default credentials authorized for the QA project.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore,Timestamp,FieldValue} from 'firebase-admin/firestore';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {makeQaFixture} from '../staging-fixture-core.mjs';

export function parseQaSeedArgs(args){
 const opts={project:null,confirm:null,adminUid:null,apply:false};
 for(let i=0;i<args.length;i++){
  const x=args[i];
  if(x==='--apply'){opts.apply=true;continue;}
  if(!['--project','--confirm','--admin-uid'].includes(x))throw Error('不明な引数です：'+x);
  if(i+1>=args.length||args[i+1].startsWith('--'))throw Error(x+' の値がありません');
  const key=x.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if(opts[key]!==null)throw Error('同じ引数を複数指定しないでください：'+x);
  opts[key]=args[++i];
 }
 if(!opts.project)throw Error('検証用Firebaseプロジェクトを --project で指定してください');
 const fixture=makeQaFixture(opts.project); // Explicitly refuses production project.
 if(opts.apply){
  if(opts.confirm!==opts.project)throw Error('書き込みには --confirm に検証用プロジェクトIDをもう一度入力してください');
  if(typeof opts.adminUid!=='string'||!/^[a-zA-Z0-9_-]{8,128}$/.test(opts.adminUid))
   throw Error('管理者の検証用GoogleログインのFirebase UIDを --admin-uid で指定してください');
 }
 return {...opts,fixture};
}
export function qaSeedEntries(opts){
 const {fixture}=opts;
 const admin=opts.adminUid?[
  {path:'admins/'+opts.adminUid,data:{enabled:true,qaOnly:true}}
 ]:[];
 return [...fixture.entries,...admin,{
  path:fixture.markerPath,data:{
   qaOnly:true,projectId:fixture.projectId,version:1,createdAt:FieldValue.serverTimestamp(),
   adminUid:opts.adminUid,fixtureMonth:fixture.publishedMonth
  }
 }];
}
async function run(){
 const opts=parseQaSeedArgs(process.argv.slice(2));
 const {fixture}=opts;
 console.log('QAプロジェクト：'+opts.project);
 console.log('架空メンバー：'+fixture.members.length+'名、公開月：'+fixture.publishedMonth+
  '／未公開承認待ち：'+fixture.draftMonth+'、初期データ数：'+fixture.entries.length+'件');
 if(!opts.apply){
  console.log('DRY-RUN: Firebaseには接続せず、1件も読み書きしていません。');
  console.log('実際にQAへ初期データを作るには --confirm [同じQA ID] --admin-uid [検証用UID] --apply が必要です。');
  return;
 }
 const app=initializeApp({credential:applicationDefault(),projectId:opts.project},'qa-fixtures');
 const db=getFirestore(app);
 if(db.projectId!==opts.project)throw Error('FirestoreのプロジェクトIDが一致しません');
 const records=qaSeedEntries(opts);
 const refs=records.map(r=>db.doc(r.path));
 // All reads are performed before writes. This is one atomic, create-only transaction.
 // Never overwrite even a single existing record, calendar, roster or admin entry.
 await db.runTransaction(async tx=>{
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  const existing=snaps.filter(x=>x.exists).map(x=>x.ref.path);
  if(existing.length)throw Error('初期化中止：検証プロジェクト内に既存のデータがあります：'+existing.slice(0,4).join('、'));
  for(let i=0;i<refs.length;i++){
   const entry=records[i];
   let data=entry.data;
   if(entry.path.includes('/months/')&&!entry.path.includes('/days/')){
    const {openAtMillis,cutoffAtMillis,...rest}=data;
    data={...rest,openAt:Timestamp.fromMillis(openAtMillis),cutoffAt:Timestamp.fromMillis(cutoffAtMillis)};
   }
   tx.create(refs[i],data);
  }
 });
 console.log('QA INITIAL DATA CREATED: '+records.length+' documents in '+opts.project+'. No production project modified.');
 console.log('管理者GoogleログインのUID：'+opts.adminUid);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 run().catch(error=>{console.error('QA SETUP REFUSED:',error.message||String(error));process.exitCode=1;});
}
