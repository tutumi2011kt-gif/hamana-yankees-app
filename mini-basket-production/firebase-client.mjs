// Real-time Firestore client for mini-basket. Inactive while firebaseConfig is null.
// Schema: teams/{teamId}/members; teams/{teamId}/months/{YYYY-MM}/{days,answers}.
// No permission bypass, server-only finalization, or administrative writes here.
import {firebaseConfig,teamId} from './firebase-config.mjs';
let connector=null;
const shortError=e=>{
 const code=e?.code||'';
 const help={
  'auth/operation-not-allowed':'Firebase Authenticationで「匿名」を有効にしてください',
  'auth/configuration-not-found':'Firebase Authenticationの設定を確認してください',
  'permission-denied':'Firestoreの安全ルール・メンバー・当番データの設定待ちです',
  'failed-precondition':'Firestoreデータベースの作成状況を確認してください',
  'auth/invalid-api-key':'FirebaseのWebアプリ設定（apiKey）を再確認してください',
  'auth/unauthorized-domain':'Firebaseの承認済みドメインにGitHub Pagesのドメインを追加してください'
 };
 return help[code]||code||e?.message||String(e);
};
export const cloudConfigured=()=>Boolean(firebaseConfig?.apiKey&&firebaseConfig?.projectId&&firebaseConfig?.appId);
export async function createCloudClient({onStatus=()=>{},onMonth=()=>{},onRoster=()=>{}}={}){
 if(!cloudConfigured()){
  onStatus({kind:'unconfigured',detail:'Firebaseの接続設定がまだありません。共有機能は未稼働です。'});
  return null;
 }
 try{
  const [fb,authModule,fs]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);
  const app=fb.initializeApp(firebaseConfig,'mini-basket-production');
  const auth=authModule.getAuth(app);
  const credential=await authModule.signInAnonymously(auth);
  const db=fs.getFirestore(app);
  const base=['teams',teamId];
  let unsubs=[],currentMonth=null,revision=0;
  const subscribe=(month)=>{
   if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Invalid month');
   revision++;const token=revision;currentMonth=month;
   unsubs.forEach(f=>f());unsubs=[];
   const pending={month,metadata:null,days:[],answers:[],loaded:{metadata:false,days:false,answers:false}};
   const emit=()=>{if(token!==revision)return;
      onMonth({...pending,ready:Object.values(pending.loaded).every(Boolean)});
   };
   const fail=e=>{if(token===revision)onStatus({kind:'error',detail:shortError(e)})};
   const add=(ref,field,transform)=>unsubs.push(fs.onSnapshot(ref,snapshot=>{
      if(token!==revision)return;
      pending[field]=transform(snapshot);
      pending.loaded[field]=true;
      emit();
   },fail));
   add(fs.doc(db,...base,'months',month),'metadata',s=>s.exists()?s.data():null);
   add(fs.collection(db,...base,'months',month,'days'),'days',s=>s.docs.map(x=>({date:x.id,...x.data()})));
   add(fs.collection(db,...base,'months',month,'answers'),'answers',s=>s.docs.map(x=>({id:x.id,...x.data()})));
   onStatus({kind:'connecting',detail:'最新の当番表を読み込み中'});
  };
  // Only one person's one date document is updated per write, preventing whole-month overwrite.
  const toggle=async ({month,date,memberId,kind})=>{
   if(!/^\d{4}-\d{2}$/.test(month)||!new RegExp('^'+month+'-\\d{2}$').test(date)
      ||!/^[a-zA-Z0-9_-]{1,80}$/.test(memberId)||!['x','o'].includes(kind)){
    throw new Error('入力の形式が正しくありません');
   }
   const docId=date+'_'+memberId,ref=fs.doc(db,...base,'months',month,'answers',docId);
   await fs.runTransaction(db,async tx=>{
    const previous=await tx.get(ref);
    if(previous.exists()&&previous.data().kind===kind){tx.delete(ref);}
    else tx.set(ref,{date,memberId,kind,updatedBy:credential.user.uid,updatedAt:fs.serverTimestamp()});
   });
  };
  const rosterStop=fs.onSnapshot(fs.collection(db,...base,'members'),
    snapshot=>onRoster(snapshot.docs.map(x=>({id:x.id,...x.data()}))),
    e=>onStatus({kind:'error',detail:shortError(e)}));
  onStatus({kind:'connected',detail:'Firebase自動同期に接続しました'});
  connector={subscribe,toggle,dispose:()=>{revision++;unsubs.forEach(f=>f());rosterStop();},userId:credential.user.uid};
  return connector;
 }catch(e){
  onStatus({kind:'error',detail:shortError(e)});
  return null;
 }
}
