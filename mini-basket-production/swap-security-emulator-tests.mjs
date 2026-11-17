// Test actual default read-only rules, distinct from legacy unsafe write-candidate rules.
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,collection,getDocs} from 'firebase/firestore';
import {readFile} from 'node:fs/promises';
const env=await initializeTestEnvironment({
 projectId:'demo-mini-basket',firestore:{rules:await readFile('firestore-parent-readonly.rules','utf8')}
});
try{
 const base='teams/aritama-mini-basket';
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'admins/admin-1'),{enabled:true});
  await setDoc(doc(db,base+'/public/roster'),{members:[{id:'yui',name:'ゆい'},{id:'haruka',name:'はるか'}],publishedMonths:['2027-02']});
  await setDoc(doc(db,base+'/members/yui'),{name:'ゆい',status:'active',startDate:'2026-12-01'});
  await setDoc(doc(db,base+'/months/2027-02'),{publication:'published',inputState:'closed'});
  await setDoc(doc(db,base+'/months/2027-02/days/2027-02-03'),{date:'2027-02-03',type:'practice',ownerId:'yui',confirmedSubstituteId:null});
  await setDoc(doc(db,base+'/months/2027-02/answers/2027-02-03_yui'),{date:'2027-02-03',memberId:'yui',kind:'x'});
  await setDoc(doc(db,base+'/months/2027-02/answers/2027-02-03_haruka'),{date:'2027-02-03',memberId:'haruka',kind:'o'});
  await setDoc(doc(db,base+'/months/2027-03'),{publication:'draft'});
  await setDoc(doc(db,base+'/months/2027-03/days/2027-03-03'),{date:'2027-03-03',type:'practice',ownerId:'mia'});
 });
 const parent=env.authenticatedContext('guest',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const admin=env.authenticatedContext('admin-1',{firebase:{sign_in_provider:'google.com'}}).firestore();
 const target=doc(parent,base+'/months/2027-02/days/2027-02-03');
 const adminTarget=doc(admin,base+'/months/2027-02/days/2027-02-03');
 // Account-free authenticated reader sees only explicitly published month.
 await assertSucceeds(getDoc(doc(parent,base+'/public/roster')));
 await assertSucceeds(getDoc(doc(parent,base+'/months/2027-02')));
 await assertSucceeds(getDoc(target));
 await assertSucceeds(getDocs(collection(parent,base+'/months/2027-02/answers')));
 await assertFails(getDoc(doc(parent,base+'/months/2027-03')));
 await assertFails(getDoc(doc(parent,base+'/months/2027-03/days/2027-03-03')));
 // Parent cannot forge any swap decision, change answers, or access the private ledger.
 await assertFails(updateDoc(target,{confirmedSubstituteId:'haruka'}));
 await assertFails(setDoc(doc(parent,base+'/months/2027-02/answers/2027-02-03_haruka'),{kind:'o'}));
 await assertFails(getDoc(doc(parent,base+'/dutyLedger/2027-02-03')));
 await assertFails(getDoc(doc(parent,base+'/members/yui')));
 await assertFails(setDoc(doc(parent,base+'/swapAudit/random'),{action:'confirm'}));
 // Admin can confirm but only updates the substitute, not original owner.
 await assertSucceeds(updateDoc(adminTarget,{confirmedSubstituteId:'haruka'}));
 const confirmed=await assertSucceeds(getDoc(target));
 if(confirmed.data().ownerId!=='yui'||confirmed.data().confirmedSubstituteId!=='haruka')throw Error('Original owner changed unexpectedly');
 await assertSucceeds(setDoc(doc(admin,base+'/swapAudit/change-1'),{action:'confirm',originalOwnerId:'yui',newSubstituteId:'haruka'}));
 console.log('PASS published read, draft concealment, anonymous write denial, admin-only swap updates and audit');
}finally{await env.cleanup();}
