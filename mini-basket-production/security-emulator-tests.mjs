import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,serverTimestamp,Timestamp} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
const env=await initializeTestEnvironment({projectId:'demo-mini-basket',firestore:{rules:await readFile('firestore-parent-write-candidate.rules','utf8')}});
try{
 const prefix='teams/aritama-mini-basket';
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,prefix+'/members/yui'),{status:'active',startDate:'2026-12-01',endDate:null});
  await setDoc(doc(db,prefix+'/months/2027-02'),{publication:'published',inputState:'open',openAt:Timestamp.fromMillis(0),cutoffAt:Timestamp.fromMillis(Date.now()+60000)});
  await setDoc(doc(db,prefix+'/months/2027-02/days/2027-02-03'),{type:'practice',ownerId:'yui'});
 });
 const auth={email_verified:true,memberIds:['yui'],firebase:{sign_in_provider:'google.com'}};
 const db=env.authenticatedContext('parent',auth).firestore();
 const path=prefix+'/months/2027-02/answers/2027-02-03_yui';
 const answer={date:'2027-02-03',memberId:'yui',kind:'x',updatedBy:'parent',updatedAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(db,path),answer));
 await assertFails(setDoc(doc(env.authenticatedContext('imposter',{...auth,memberIds:['mia']}).firestore(),path),{...answer,updatedBy:'imposter'}));
 await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),path),answer));
 await assertFails(setDoc(doc(db,path),{...answer,kind:'o'}));
 await assertFails(setDoc(doc(db,path),{...answer,extra:true}));
 await assertFails(setDoc(doc(db,prefix+'/months/2027-02/days/2027-02-03'),{ownerId:'mia'}));
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),prefix+'/months/2027-02'),{publication:'published',inputState:'open',openAt:Timestamp.fromMillis(0),cutoffAt:Timestamp.fromMillis(1)}));
 await assertFails(setDoc(doc(db,path),answer));
 console.log('PASS emulator identity, impersonation, anonymous, invalid kind, extra fields, owner mutation, cutoff');
}finally{await env.cleanup();}
