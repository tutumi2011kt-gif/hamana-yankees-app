// Read-only default rules must prevent leaked unpublished/unlisted month data.
// Emulator only: no Firebase production or QA access.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc} from 'firebase/firestore';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))
 throw Error('Local Firebase emulator required, never use real Firebase');
const env=await initializeTestEnvironment({
 projectId:'demo-mini-basket',firestore:{
  rules:await readFile(new URL('./firestore-parent-readonly.rules',import.meta.url),'utf8')
 }
});
const root='teams/aritama-mini-basket';
const monthPath=m=>root+'/months/'+m;
const dayPath=m=>monthPath(m)+'/days/'+m+'-02';
const answersPath=m=>monthPath(m)+'/answers';
const ansPath=m=>answersPath(m)+'/'+m+'-02_yui';
const rosterPath=root+'/public/roster';
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'admins/readonly-admin'),{enabled:true});
  await setDoc(doc(db,rosterPath),{
   members:[{id:'yui',name:'ゆい',status:'active'}],
   publishedMonths:['2026-12','2027-03']
  });
  for(const [month,publication] of [
   ['2026-12','published'],['2027-01','published'],['2027-03','draft']
  ]){
   await setDoc(doc(db,monthPath(month)),{publication,inputState:'closed'});
   await setDoc(doc(db,dayPath(month)),{date:month+'-02',type:'practice',ownerId:'yui'});
   await setDoc(doc(db,ansPath(month)),{date:month+'-02',memberId:'yui',kind:'x'});
  }
 });
 const parent=env.authenticatedContext('readonly-parent',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const admin=env.authenticatedContext('readonly-admin',{firebase:{sign_in_provider:'google.com'}}).firestore();
 const anonymous=env.unauthenticatedContext().firestore();
 const visible=await assertSucceeds(getDoc(doc(parent,monthPath('2026-12'))));
 assert.equal(visible.data().publication,'published');
 await assertSucceeds(getDocs(collection(parent,monthPath('2026-12')+'/days')));
 await assertSucceeds(getDocs(collection(parent,answersPath('2026-12'))));
 // January is published in metadata but missing from public/roster publishedMonths.
 await assertFails(getDoc(doc(parent,monthPath('2027-01'))));
 await assertFails(getDoc(doc(parent,dayPath('2027-01'))));
 await assertFails(getDocs(collection(parent,monthPath('2027-01')+'/days')));
 await assertFails(getDoc(doc(parent,ansPath('2027-01'))));
 await assertFails(getDocs(collection(parent,answersPath('2027-01'))));
 // March is listed but intentionally draft. The publishedMonths list cannot override draft.
 await assertFails(getDoc(doc(parent,monthPath('2027-03'))));
 await assertFails(getDoc(doc(parent,dayPath('2027-03'))));
 await assertFails(getDocs(collection(parent,answersPath('2027-03'))));
 // Source remains read-only even when both month conditions hold.
 await assertFails(setDoc(doc(parent,ansPath('2026-12')),{kind:'o'}));
 await assertFails(deleteDoc(doc(parent,ansPath('2026-12'))));
 await assertFails(setDoc(doc(parent,dayPath('2026-12')),{type:'rest'}));
 await assertFails(getDoc(doc(anonymous,rosterPath)));
 await assertFails(getDoc(doc(anonymous,monthPath('2026-12'))));
 // A verified administrator can still inspect draft/unlisted months.
 await assertSucceeds(getDoc(doc(admin,monthPath('2027-01'))));
 await assertSucceeds(getDoc(doc(admin,monthPath('2027-03'))));
 // If a manager adds January to publishedMonths, it becomes visible without rewriting its days.
 await assertSucceeds(updateDoc(doc(admin,rosterPath),{publishedMonths:['2026-12','2027-01','2027-03']}));
 await assertSucceeds(getDoc(doc(parent,monthPath('2027-01'))));
 await assertSucceeds(getDocs(collection(parent,monthPath('2027-01')+'/days')));
 // A manager can hide an already published month; parent reads immediately stop.
 await assertSucceeds(updateDoc(doc(admin,rosterPath),{publishedMonths:['2027-01','2027-03']}));
 await assertFails(getDoc(doc(parent,monthPath('2026-12'))));
 await assertFails(getDocs(collection(parent,answersPath('2026-12'))));
 console.log('PASS readonly emulator: listed published months readable, unlisted/draft denied, admin intact, parent writes denied');
}finally{await env.cleanup();}
