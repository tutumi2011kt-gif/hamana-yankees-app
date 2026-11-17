// Emulator-only 15-device simultaneous write + cutoff + admin confirmation test.
// No production data, no actual iPhones, no Firebase production rules deployment.
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,Timestamp,serverTimestamp} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
import {defaultOpenMillis} from './parent-input-core.mjs';
import {jstInputCutoffMillis} from './month-rollover-core.mjs';

const month='2027-01',date='2027-01-06';
const base='teams/aritama-mini-basket',prefix=base+'/months/'+month;
const people=['yui','wakana','mia','an','mai','koharu','nagisa','nodoka','sayaka','haruka','kaho','sawa'];
const env=await initializeTestEnvironment({projectId:'demo-mini-basket',firestore:{
 rules:await readFile('firestore-parent-anonymous-write-candidate.rules','utf8')
}});
const answer=(id,uid,kind='o')=>({date,memberId:id,kind,updatedAt:serverTimestamp(),updatedBy:uid});
const contexts=Array.from({length:15},(_,i)=>env.authenticatedContext('phone-'+i,{firebase:{sign_in_provider:'anonymous'}}).firestore());
const answerRef=(db,id,answerDate=date)=>doc(db,prefix+'/answers/'+answerDate+'_'+id);
try{
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,base+'/public/roster'),{publishedMonths:[month],members:people.map(id=>({id,name:id,status:'active'}))});
  const now=Date.now();
  await setDoc(doc(db,base+'/months/'+month),{
   publication:'published',inputState:'open',openAt:Timestamp.fromMillis(now-86400000),
   cutoffAt:Timestamp.fromMillis(now+3600000)
  });
  for(const id of people){
   await setDoc(doc(db,base+'/members/'+id),{status:'active',startDate:'2026-12-01',endDate:null});
  }
  await setDoc(doc(db,prefix+'/days/'+date),{type:'practice',ownerId:'yui',confirmedSubstituteId:null});
  await setDoc(doc(db,prefix+'/days/2027-01-08'),{type:'practice',ownerId:'yui',confirmedSubstituteId:null});
 });
 // 15 concurrent operations across 15 separate anonymous clients:
 // 12 lawful member answers plus 3 deliberately invalid writes.
 const ops=people.map((id,i)=>({
  expected:true,
  job:setDoc(answerRef(contexts[i],id),answer(id,'phone-'+i,id==='yui'?'x':'o'))
 }));
 ops.push({
  expected:false,
  job:setDoc(answerRef(contexts[12],'yui','2027-01-08'),{
   date:'2027-01-08',memberId:'yui',kind:'o',updatedAt:serverTimestamp(),updatedBy:'phone-12'
  })
 });
 ops.push({
  expected:false,
  job:setDoc(answerRef(contexts[13],'wakana','2027-01-08'),{
   date:'2027-01-08',memberId:'wakana',kind:'x',updatedAt:serverTimestamp(),updatedBy:'phone-13'
  })
 });
 ops.push({
  expected:false,
  job:setDoc(answerRef(contexts[14],'sawa','2027-01-08'),{
   date:'2027-01-08',memberId:'sawa',kind:'o',updatedAt:serverTimestamp(),updatedBy:'phone-14',tamper:true
  })
 });
 const results=await Promise.allSettled(ops.map(o=>o.job));
 for(let i=0;i<results.length;i++)
  assert.equal(results[i].status,ops[i].expected?'fulfilled':'rejected',
   'unexpected result for anonymous device '+i);
 const visible=await assertSucceeds(getDocs(collection(contexts[14],prefix+'/answers')));
 assert.equal(visible.size,12,'12 valid answers are immediately available to other signed-in viewers');
 assert.ok(visible.docs.some(x=>x.id===date+'_yui'&&x.data().kind==='x'));
 assert.ok(visible.docs.some(x=>x.id===date+'_haruka'&&x.data().kind==='o'));
 console.log('PASS 15 simultaneous devices: 12 lawful answers published, 3 invalid attempts rejected');

 // Two different phones racing to claim the first response for the same child/day.
 const r1=doc(contexts[12],prefix+'/answers/2027-01-08_yui');
 const r2=doc(contexts[13],prefix+'/answers/2027-01-08_yui');
 const raced=await Promise.allSettled([
  setDoc(r1,{date:'2027-01-08',memberId:'yui',kind:'x',updatedAt:serverTimestamp(),updatedBy:'phone-12'}),
  setDoc(r2,{date:'2027-01-08',memberId:'yui',kind:'x',updatedAt:serverTimestamp(),updatedBy:'phone-13'})
 ]);
 assert.equal(raced.filter(x=>x.status==='fulfilled').length,1,'only one device can claim a new answer');
 const winner=(await getDoc(r1)).data().updatedBy;
 assert.ok(['phone-12','phone-13'].includes(winner));
 console.log('PASS same child/date race: only first anonymous writer can own answer');

 // Manager finalizes a substitute; all further parent writes for that date fail.
 await env.withSecurityRulesDisabled(context=>updateDoc(doc(context.firestore(),prefix+'/days/'+date),{
  confirmedSubstituteId:'haruka'
 }));
 const closedAfterSwap=await Promise.all(people.map((id,i)=>assertFails(setDoc(
  answerRef(contexts[i],id),answer(id,'phone-'+i,id==='yui'?'x':'o')
 ))));
 assert.equal(closedAfterSwap.length,12);
 assert.equal((await getDocs(collection(contexts[0],prefix+'/answers'))).size,13);
 console.log('PASS manager-confirmed swap locks further parent updates, without erasing answers');

 // Monthly deadline is enforced by server request.time, even if inputState is accidentally "open".
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await updateDoc(doc(db,prefix+'/days/'+date),{confirmedSubstituteId:null});
  await updateDoc(doc(db,base+'/months/'+month),{cutoffAt:Timestamp.fromMillis(Date.now()-1)});
 });
 await assertFails(setDoc(answerRef(contexts[0],'yui'),answer('yui','phone-0','x')));
 await assertFails(setDoc(answerRef(contexts[3],'an'),answer('an','phone-3','o')));
 console.log('PASS expired cutoff always rejects writes, even with open inputState');

 // Pure JST boundary: 2026-12-01 00:00 JST is first instant forbidden for January.
 const cutoff=jstInputCutoffMillis(month);
 assert.equal(cutoff,Date.parse('2026-12-01T00:00:00+09:00'));
 assert.ok(cutoff>defaultOpenMillis(month));
 console.log('PASS Japan midnight timestamp boundary, independent of device timezone');
}finally{
 await env.cleanup();
}
