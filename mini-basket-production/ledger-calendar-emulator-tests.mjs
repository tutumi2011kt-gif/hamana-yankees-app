import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import * as api from 'firebase/firestore';
import {persistLedger,calendarState} from './ledger-calendar-core.mjs';
import {buildDutyLedgerRecord,ledgerTotals} from './duty-ledger-core.mjs';
if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');
const env=await initializeTestEnvironment({projectId:'demo-mini-basket',firestore:{rules:await readFile('firestore-parent-anonymous-write-candidate.rules','utf8')}});
const root='teams/aritama-mini-basket',date='2027-01-06',ids=['qa01','qa02'];
const dayPath=root+'/months/2027-01/days/'+date,ledgerPath=root+'/dutyLedger/'+date;
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await api.setDoc(api.doc(db,'admins/ledger-admin'),{enabled:true});
  // A visible month must also appear in the public roster; otherwise parent reads are denied.
  await api.setDoc(api.doc(db,root+'/public/roster'),{
   publishedMonths:['2027-01'],members:ids.map(id=>({id,name:id,status:'active'}))
  });
  await api.setDoc(api.doc(db,root+'/months/2027-01'),{publication:'published',inputState:'open',openAt:api.Timestamp.fromMillis(0),cutoffAt:api.Timestamp.fromMillis(Date.now()+3600000)});
  for(const id of ids)await api.setDoc(api.doc(db,root+'/members/'+id),{status:'active',startDate:'2026-12-01'});
  await api.setDoc(api.doc(db,dayPath),{date,type:'practice',ownerId:'qa01',confirmedSubstituteId:null,activityVerified:true});
  await api.setDoc(api.doc(db,root+'/months/2027-01/answers/'+date+'_qa01'),{date,memberId:'qa01',kind:'x',updatedBy:'parent',updatedAt:api.Timestamp.now()});
 });
 const db=env.authenticatedContext('ledger-admin',{firebase:{sign_in_provider:'google.com'}}).firestore();
 const parent=env.authenticatedContext('parent',{firebase:{sign_in_provider:'anonymous'}}).firestore();
 const read=async path=>{const s=await api.getDoc(api.doc(db,path));return s.exists()?s.data():null;};
 const build=values=>buildDutyLedgerRecord({date,scheduledOwnerId:'qa01',...values},ids,'2027-06-01');
 const write=async(record,overrides={})=>persistLedger({api,db,teamId:'aritama-mini-basket',uid:'ledger-admin',date,record,expected:await read(ledgerPath),expectedDay:await read(dayPath),...overrides});
 const initial=await read(dayPath);
 await write(build({status:'completed',actualOwnerId:'qa01'}));
 const stale=await read(ledgerPath);
 await write(build({status:'completed',actualOwnerId:'qa02'}));
 assert.deepEqual(ledgerTotals(ids,[await read(ledgerPath)],'2027-04').counts,{qa01:0,qa02:1});
 await assert.rejects(write(build({status:'completed',actualOwnerId:'qa01'}),{expected:stale}),/台帳が変更/);
 console.log('PASS shared UI transaction: actual-count correction and stale ledger rejection');
 await write(build({status:'cancelled',reason:'game',carryState:'pending'}));
 let day=await read(dayPath),record=await read(ledgerPath);
 assert.equal(day.type,'game');assert.equal(day.ownerId,null);assert.equal(day.activityVerified,true);
 assert.equal(record.calendarBefore.ownerId,'qa01');
 assert.equal(ledgerTotals(ids,[record],'2027-04').carry.qa01,1);
 assert.deepEqual(ledgerTotals(ids,[record],'2027-04').counts,{qa01:0,qa02:0});
 const answer=api.doc(parent,root+'/months/2027-01/answers/'+date+'_qa01');
 assert.equal((await api.getDoc(answer)).data().kind,'x');
 await assertFails(api.deleteDoc(answer));
 await assertFails(api.setDoc(api.doc(parent,root+'/months/2027-01/answers/'+date+'_qa02'),{date,memberId:'qa02',kind:'o',updatedBy:'parent',updatedAt:api.serverTimestamp()}));
 console.log('PASS atomic game cancellation: calendar cleared, answers preserved and locked, carry counted');
 await write(build({status:'cancelled',reason:'rest',carryState:'resolved',carryResolvedDate:'2027-04-10'}));
 record=await read(ledgerPath);assert.equal(record.calendarBefore.type,'practice');
 assert.equal((await read(dayPath)).type,'rest');
 assert.equal(ledgerTotals(ids,[record],'2027-05').carry.qa01,0);
 await write(null);
 assert.equal(await read(ledgerPath),null);
 assert.deepEqual(calendarState(await read(dayPath)),calendarState(initial));
 assert.equal((await api.getDoc(answer)).data().kind,'x');
 console.log('PASS edit cancelled reason, resolve carry, undo restores calendar without deleting answers');
 await write(build({status:'cancelled',reason:'game',carryState:'pending'}));
 const beforeConflict=await read(ledgerPath);
 await api.updateDoc(api.doc(db,dayPath),{ownerId:'qa02'});
 await assert.rejects(write(null),/中止後に日別予定/);
 assert.deepEqual(await read(ledgerPath),beforeConflict);
 console.log('PASS changed calendar refuses undo without partial ledger deletion');
 await assertFails(persistLedger({api,db:parent,teamId:'aritama-mini-basket',uid:'parent',date,record:null,expected:beforeConflict,expectedDay:await read(dayPath)}));
 const audit=await api.getDocs(api.collection(db,root+'/dutyLedgerAudit'));
 assert.equal(audit.size,6);
 console.log('PASS parent cannot edit ledger and all six successful operations have audit records');
}finally{await env.cleanup();}
