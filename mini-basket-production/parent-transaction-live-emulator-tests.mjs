// Real client-style Firestore transactions and onSnapshot between two anonymous devices.
// Distinct from setDoc rules tests: catches unreadable docs in transactions and subscription bugs.
// No real Firebase project is accessed; never execute against production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,onSnapshot,runTransaction,
        setDoc,serverTimestamp,Timestamp,updateDoc} from 'firebase/firestore';
import {allowedAnswerKind,canEditMonth,decideAnswerAction} from './parent-input-core.mjs';
import {canEditSwapAnswer} from './swap-confirmation-core.mjs';

const env=await initializeTestEnvironment({
 projectId:'demo-mini-basket',firestore:{rules:await readFile('firestore-parent-anonymous-write-candidate.rules','utf8')}
});
const base='teams/aritama-mini-basket',month='2027-01',day='2027-01-06';
const dbParent=env.authenticatedContext('phone-owner',{firebase:{sign_in_provider:'anonymous'}}).firestore();
const dbVolunteer=env.authenticatedContext('phone-volunteer',{firebase:{sign_in_provider:'anonymous'}}).firestore();
const dbViewer=env.authenticatedContext('phone-viewer',{firebase:{sign_in_provider:'anonymous'}}).firestore();
const answerRef=(db,member,date=day)=>doc(db,base+'/months/'+month+'/answers/'+date+'_'+member);
const monthRef=db=>doc(db,base+'/months/'+month);
const dayRef=(db,date=day)=>doc(db,base+'/months/'+month+'/days/'+date);
const rosterRef=db=>doc(db,base+'/public/roster');

async function tapAsParent(db,uid,member,kind,date=day){
 const aRef=answerRef(db,member,date);
 return runTransaction(db,async tx=>{
  // Keep the exact 4 reads used in the parent.html transaction.
  const [mSnap,dSnap,rSnap,aSnap]=await Promise.all([
   tx.get(monthRef(db)),tx.get(dayRef(db,date)),tx.get(rosterRef(db)),tx.get(aRef)
  ]);
  if(!mSnap.exists()||!canEditMonth(mSnap.data()))throw Error('締切済み');
  if(!dSnap.exists()||!canEditSwapAnswer(dSnap.data())||
     !allowedAnswerKind({kind,ownerId:dSnap.data().ownerId,memberId:member,dayType:dSnap.data().type}))
   throw Error('回答できない日');
  if(!rSnap.exists()||!rSnap.data().members.some(x=>x.id===member&&x.status==='active'))
   throw Error('メンバー情報がありません');
  const action=decideAnswerAction(aSnap.exists()?aSnap.data():null,kind,uid);
  if(action==='different-device'||action==='blocked')throw Error('別端末からの回答');
  if(action==='delete')tx.delete(aRef);
  else tx.set(aRef,{date,memberId:member,kind,updatedAt:serverTimestamp(),updatedBy:uid});
  return action;
 });
}
function watchAnswers(db){
 const states=[],waiters=[];
 let watcherError=null;
 const stop=onSnapshot(collection(db,base+'/months/'+month+'/answers'),
  snap=>{
   const a=snap.docs.map(d=>({id:d.id,kind:d.data().kind})).sort((x,y)=>x.id.localeCompare(y.id));
   states.push(a);
   for(const w of [...waiters])if(w.predicate(a)){
    clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(a);
   }
  },
  err=>{watcherError=err;for(const w of waiters.splice(0)){clearTimeout(w.timer);w.reject(err);}}
 );
 return {
  states,
  waitFor(predicate){
   if(watcherError)return Promise.reject(watcherError);
   const matched=states.find(predicate);
   if(matched)return Promise.resolve(matched);
   return new Promise((resolve,reject)=>{
    const w={predicate,resolve,reject,timer:null};
    w.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);
     reject(Error('他端末へリアルタイム反映されませんでした'));},7000);
    waiters.push(w);
   });
  },
  close(){stop();for(const w of waiters.splice(0)){clearTimeout(w.timer);w.reject(Error('listener closed'));}}
 };
}
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  const now=Date.now();
  await Promise.all([
   setDoc(rosterRef(db),{publishedMonths:[month],members:[
    {id:'qa01',name:'テスト01',status:'active'},{id:'qa02',name:'テスト02',status:'active'}]}),
   setDoc(monthRef(db),{publication:'published',inputState:'open',
    openAt:Timestamp.fromMillis(now-60000),cutoffAt:Timestamp.fromMillis(now+120000)}),
   setDoc(dayRef(db),{date:day,type:'practice',ownerId:'qa01',confirmedSubstituteId:null}),
   setDoc(doc(db,base+'/members/qa01'),{status:'active',startDate:'2026-12-01',endDate:null}),
   setDoc(doc(db,base+'/members/qa02'),{status:'active',startDate:'2026-12-01',endDate:null})
  ]);
 });
 const stream=watchAnswers(dbViewer);
 try{
  await stream.waitFor(a=>a.length===0);
  assert.equal(await assertSucceeds(tapAsParent(dbParent,'phone-owner','qa01','x')),'set');
  await stream.waitFor(a=>a.some(x=>x.id===day+'_qa01'&&x.kind==='x'));
  console.log('PASS real parent transaction x is visible to another anonymous device in realtime');
  assert.equal(await assertSucceeds(tapAsParent(dbVolunteer,'phone-volunteer','qa02','o')),'set');
  await stream.waitFor(a=>a.length===2&&a.some(x=>x.id===day+'_qa02'&&x.kind==='o'));
  console.log('PASS voluntary o instantly shared without auto-reassigning original owner');

  await assertFails(tapAsParent(dbVolunteer,'phone-volunteer','qa01','x'));
  assert.equal((await getDoc(dayRef(dbViewer))).data().ownerId,'qa01');
  console.log('PASS different anonymous device cannot overwrite owner x');

  assert.equal(await assertSucceeds(tapAsParent(dbParent,'phone-owner','qa01','x')),'delete');
  await stream.waitFor(a=>a.length===1&&a[0].id===day+'_qa02');
  console.log('PASS same device can cancel own answer and viewer sees deletion');

  await env.withSecurityRulesDisabled(ctx=>updateDoc(dayRef(ctx.firestore()),{
   confirmedSubstituteId:'qa02'
  }));
  await assertFails(tapAsParent(dbVolunteer,'phone-volunteer','qa02','o'));
  assert.equal((await getDoc(dayRef(dbViewer))).data().ownerId,'qa01');
  console.log('PASS manager-confirmed substitute locks further x/o changes and preserves owner');

  await env.withSecurityRulesDisabled(async ctx=>{
   await updateDoc(dayRef(ctx.firestore()),{confirmedSubstituteId:null});
   await updateDoc(monthRef(ctx.firestore()),{cutoffAt:Timestamp.fromMillis(Date.now()-1000)});
  });
  await assertFails(tapAsParent(dbParent,'phone-owner','qa01','x'));
  console.log('PASS server cutoff wins over stale parent UI');
 }finally{stream.close();}
}finally{await env.cleanup();}
