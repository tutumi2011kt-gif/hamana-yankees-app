// Run only against local Firestore emulator. Candidate rules MUST NOT be deployed.
// This test deliberately demonstrates that picking any child's name cannot prove parent identity.
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,deleteDoc,getDoc,getDocs,collection,serverTimestamp,Timestamp} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
const env=await initializeTestEnvironment({
 projectId:'demo-mini-basket',
 firestore:{rules:await readFile('firestore-parent-anonymous-write-candidate.rules','utf8')}
});
const base='teams/aritama-mini-basket';
const month='2027-01';
const answer=(date,memberId,kind,uid)=>({
 date,memberId,kind,updatedBy:uid,updatedAt:serverTimestamp()
});
const path=(date,id)=>base+'/months/'+month+'/answers/'+date+'_'+id;
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore(),now=Date.now();
  await setDoc(doc(db,'admins/admin-1'),{enabled:true});
  await setDoc(doc(db,base+'/public/roster'),{publishedMonths:[month],members:[{id:'yui',name:'ゆい'},{id:'haruka',name:'はるか'},{id:'sawa',name:'村松さわ'}]});
  await setDoc(doc(db,base+'/months/'+month),{publication:'published',inputState:'open',openAt:Timestamp.fromMillis(now-86400000),cutoffAt:Timestamp.fromMillis(now+3600000)});
  for(const id of ['yui','haruka','sawa']){
   await setDoc(doc(db,base+'/members/'+id),{status:'active',startDate:id==='sawa'?'2027-01-01':'2026-12-01',endDate:null});
  }
  await setDoc(doc(db,base+'/months/'+month+'/days/2027-01-06'),{type:'practice',ownerId:'yui',confirmedSubstituteId:null});
  await setDoc(doc(db,base+'/months/'+month+'/days/2027-01-08'),{type:'practice',ownerId:'yui',confirmedSubstituteId:null});
  await setDoc(doc(db,base+'/months/'+month+'/days/2027-01-09'),{type:'game',ownerId:null});
  await setDoc(doc(db,base+'/months/'+month+'/days/2027-01-10'),{type:'rest',ownerId:null});
  await setDoc(doc(db,base+'/months/2027-03'),{publication:'draft',inputState:'open',openAt:Timestamp.fromMillis(now-86400000),cutoffAt:Timestamp.fromMillis(now+3600000)});
  await setDoc(doc(db,base+'/months/2027-03/days/2027-03-03'),{type:'practice',ownerId:'yui',confirmedSubstituteId:null});
  await setDoc(doc(db,base+'/months/2026-12'),{publication:'published',inputState:'open',openAt:Timestamp.fromMillis(now-86400000),cutoffAt:Timestamp.fromMillis(now+3600000)});
  await setDoc(doc(db,base+'/months/2026-12/days/2026-12-02'),{type:'practice',ownerId:'yui'});
 });
 const alice=env.authenticatedContext('alice',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const bob=env.authenticatedContext('bob',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const admin=env.authenticatedContext('admin-1',{firebase:{sign_in_provider:'google.com'}}).firestore();
 const outsider=env.unauthenticatedContext().firestore();
 const owner=doc(alice,path('2027-01-06','yui'));
 const volunteer=doc(bob,path('2027-01-06','haruka'));
 await assertSucceeds(getDoc(doc(alice,base+'/months/'+month)));
 await assertSucceeds(getDocs(collection(alice,base+'/months/'+month+'/days')));
 await assertFails(getDoc(doc(alice,base+'/months/2027-03')));
 await assertFails(getDoc(doc(alice,base+'/months/2027-03/days/2027-03-03')));
 await assertFails(getDoc(doc(alice,base+'/members/yui')));
 await assertFails(getDoc(doc(alice,base+'/dutyLedger/2027-01-06')));
 await assertFails(getDoc(doc(alice,'admins/admin-1')));
 await assertSucceeds(setDoc(owner,answer('2027-01-06','yui','x','alice')));
 await assertSucceeds(setDoc(volunteer,answer('2027-01-06','haruka','o','bob')));
 // Both update and cancellation from original device only.
 await assertSucceeds(setDoc(owner,answer('2027-01-06','yui','x','alice')));
 await assertFails(setDoc(doc(bob,path('2027-01-06','yui')),answer('2027-01-06','yui','x','bob')));
 await assertFails(deleteDoc(doc(bob,path('2027-01-06','yui'))));
 await assertFails(setDoc(doc(alice,path('2027-01-06','haruka')),answer('2027-01-06','haruka','o','alice')));
 await assertFails(setDoc(doc(outsider,path('2027-01-06','sawa')),answer('2027-01-06','sawa','o','guest')));
 await assertFails(setDoc(doc(alice,path('2027-01-06','yui')),answer('2027-01-06','yui','o','alice')));
 await assertFails(setDoc(doc(alice,path('2027-01-06','haruka')),answer('2027-01-06','haruka','x','alice')));
 await assertFails(setDoc(doc(alice,path('2027-01-06','not-in-team')),answer('2027-01-06','not-in-team','o','alice')));
 await assertFails(setDoc(doc(alice,path('2027-01-09','sawa')),answer('2027-01-09','sawa','o','alice')));
 await assertFails(setDoc(doc(alice,path('2027-01-10','sawa')),answer('2027-01-10','sawa','o','alice')));
 await assertFails(setDoc(doc(alice,path('2027-01-06','sawa')),{...answer('2027-01-06','sawa','o','alice'),admin:true}));
 await assertFails(setDoc(doc(alice,path('2027-01-06','sawa')),{...answer('2027-01-06','sawa','o','other')}));
 await assertFails(setDoc(doc(alice,base+'/months/'+month+'/days/2027-01-06'),{type:'practice',ownerId:'sawa'}));
 await assertFails(setDoc(doc(alice,base+'/swapAudit/spoof'),{action:'confirm'}));
 await assertFails(setDoc(doc(alice,base+'/dutyLedger/2027-01-06'),{status:'completed'}));
 await assertFails(setDoc(doc(alice,base+'/months/2026-12/answers/2026-12-02_yui'),answer('2026-12-02','yui','x','alice')));
 await assertFails(setDoc(doc(alice,base+'/months/2027-03/answers/2027-03-03_yui'),answer('2027-03-03','yui','x','alice')));
 await assertSucceeds(setDoc(doc(alice,path('2027-01-06','sawa')),answer('2027-01-06','sawa','o','alice')));
 await assertSucceeds(deleteDoc(doc(alice,path('2027-01-06','sawa'))));
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),base+'/months/'+month+'/days/2027-01-06'),{type:'practice',ownerId:'yui',confirmedSubstituteId:'haruka'}));
 await assertFails(setDoc(owner,answer('2027-01-06','yui','x','alice')));
 await assertFails(deleteDoc(owner));
 await assertFails(setDoc(doc(bob,path('2027-01-06','sawa')),answer('2027-01-06','sawa','o','bob')));
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),base+'/months/'+month),{publication:'published',inputState:'open',openAt:Timestamp.fromMillis(0),cutoffAt:Timestamp.fromMillis(1)}));
 await assertFails(setDoc(doc(alice,path('2027-01-08','haruka')),answer('2027-01-08','haruka','o','alice')));
 await assertFails(deleteDoc(volunteer));
 await assertSucceeds(updateDoc(doc(admin,base+'/months/'+month+'/days/2027-01-06'),{confirmedSubstituteId:null}));
 // Restored open month for a deliberately documented impersonation demonstration:
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),base+'/months/'+month),{publication:'published',inputState:'open',openAt:Timestamp.fromMillis(Date.now()-10000),cutoffAt:Timestamp.fromMillis(Date.now()+3600000)}));
 // UNRESOLVED RISK: Bob can send a first-ever × using Yui's name on another day.
 await assertSucceeds(setDoc(doc(bob,path('2027-01-08','yui')),answer('2027-01-08','yui','x','bob')));
 console.log('PASS anonymous candidate: strict fields, published month, UTC cutoff, same-device edits, no manager mutations');
 console.log('KNOWN RISK DEMONSTRATED: anonymous UID can impersonate any member on an unclaimed date. NOT SAFE TO DEPLOY without explicit user risk acceptance.');
}finally{await env.cleanup();}
