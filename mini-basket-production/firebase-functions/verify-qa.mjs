// Read-only isolated QA Firebase preflight; never mutates data.
// Offline default checks fictitious fixture without credentials.
// Remote: --project <qa-id> --admin-uid <qa-admin-uid> --confirm <same-qa-id> --remote
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeQaFixture} from '../staging-fixture-core.mjs';
import {checkQaReadiness,qaReadinessReport} from '../qa-readiness-core.mjs';

export function parseQaVerifyArgs(args){
 const out={project:null,confirm:null,adminUid:null,remote:false};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--remote'){out.remote=true;continue;}
  if(!['--project','--confirm','--admin-uid'].includes(arg))throw Error('不明な引数：'+arg);
  if(!args[i+1]||args[i+1].startsWith('--'))throw Error(arg+' の値がありません');
  const field=arg.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if(out[field]!=null)throw Error('同じ引数の重複：'+arg);
  out[field]=args[++i];
 }
 if(!out.project)throw Error('--project に検証用FirebaseのIDを指定してください');
 makeQaFixture(out.project); // Rejects production ID before importing Firebase Admin.
 if(out.remote){
  if(out.confirm!==out.project)throw Error('実際の読み取りには同じQAプロジェクトIDを --confirm で再指定してください');
  if(!out.adminUid||!/^[A-Za-z0-9_-]{8,128}$/.test(out.adminUid))
   throw Error('QA側のGoogle管理者UIDを --admin-uid で指定してください');
 }
 return out;
}
const documentData=snap=>snap.exists?snap.data():null;
async function readSnapshot(db,fixture,uid){
 const team='teams/'+fixture.teamId;
 const [marker,roster,admin,jan,mar]=await Promise.all([
  db.doc(fixture.markerPath).get(),
  db.doc(team+'/public/roster').get(),
  db.doc('admins/'+uid).get(),
  db.doc(team+'/months/'+fixture.publishedMonth).get(),
  db.doc(team+'/months/'+fixture.draftMonth).get()
 ]);
 const [members,janDays,marDays,monthDocs]=await Promise.all([
  db.collection(team+'/members').get(),
  db.collection(team+'/months/'+fixture.publishedMonth+'/days').get(),
  db.collection(team+'/months/'+fixture.draftMonth+'/days').get(),
  db.collection(team+'/months').get()
 ]);
 return {
  marker:documentData(marker),roster:documentData(roster),admin:documentData(admin),
  months:{
   [fixture.publishedMonth]:documentData(jan),
   [fixture.draftMonth]:documentData(mar)
  },
  members:members.docs.map(d=>({id:d.id,...d.data()})),
  days:{
   [fixture.publishedMonth]:janDays.docs.map(d=>({date:d.id,...d.data()})),
   [fixture.draftMonth]:marDays.docs.map(d=>({date:d.id,...d.data()}))
  },
  unexpectedMonthIds:monthDocs.docs.map(d=>d.id).filter(id=>![fixture.publishedMonth,fixture.draftMonth].includes(id))
 };
}
export async function runQaVerify(args){
 const opts=parseQaVerifyArgs(args);
 if(!opts.remote){
  const fixture=makeQaFixture(opts.project);
  console.log('DRY-RUN: 検証専用Firebase '+fixture.projectId+' の構成のみ確認しました。');
  console.log('Firebaseへ接続せず、読み取りも書き込みも行っていません。');
  console.log('クラウド上の準備を確かめる場合は --confirm [同じQA ID] --admin-uid [QA側UID] --remote を指定します。');
  return true;
 }
 // Firebase Admin SDK is loaded only after the guarded remote flag.
 const [{initializeApp,applicationDefault,deleteApp},{getFirestore}]=await Promise.all([
  import('firebase-admin/app'),import('firebase-admin/firestore')
 ]);
 const app=initializeApp({credential:applicationDefault(),projectId:opts.project},'qa-read-only-verification');
 try{
  const db=getFirestore(app);
  if(db.projectId!==opts.project)throw Error('Firestoreへの接続先プロジェクトIDが一致しません');
  const result=checkQaReadiness({
   projectId:opts.project,
   snapshot:await readSnapshot(db,makeQaFixture(opts.project),opts.adminUid)
  });
  console.log(qaReadinessReport(result));
  if(!result.pass)throw Error('検証専用Firebaseの初期状態に未解決の問題があります');
  return true;
 }finally{await deleteApp(app);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 runQaVerify(process.argv.slice(2)).catch(e=>{console.error('QA VERIFY ERROR:',e.message||String(e));process.exitCode=1;});
