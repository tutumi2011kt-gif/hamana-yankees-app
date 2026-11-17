import assert from 'node:assert/strict';
import {planLedgerCalendar,calendarState} from './ledger-calendar-core.mjs';
import {swapState} from './swap-confirmation-core.mjs';
const day={date:'2027-01-06',type:'practice',ownerId:'qa01',confirmedSubstituteId:'qa02'};
const record={status:'cancelled',reason:'game',scheduledOwnerId:'qa01'};
const plan=planLedgerCalendar({date:day.date,day,record,revision:1});
assert.equal(plan.dayPatch.confirmedSubstituteId,null);
assert.equal(plan.calendarBefore.confirmedSubstituteId,'qa02');
assert.throws(()=>planLedgerCalendar({date:'2026-12-09',day,record,revision:1}),/12月/);
assert.equal(planLedgerCalendar({date:day.date,day,record:{...record,reason:'personal'},revision:1}).dayPatch,null);
const restore=planLedgerCalendar({date:day.date,day:plan.dayPatch,prior:plan,record:null,revision:2});
assert.deepEqual(restore.dayPatch,calendarState(day));
assert.throws(()=>planLedgerCalendar({date:day.date,day:{...day,ownerId:'qa02'},record,revision:1}),/元担当者/);
for(const members of [[{id:'qa02',status:'inactive',startDate:'2026-01-01',endDate:'2027-12-01'}],[{id:'qa02',status:'active',startDate:'2027-02-01',endDate:'2027-12-01'}],[{id:'other',status:'active',startDate:'2026-01-01'}]]){
 const state=swapState({...day,confirmedSubstituteId:null},[{date:day.date,memberId:'qa01',kind:'x'},{date:day.date,memberId:'qa02',kind:'o'}],members);
 assert.equal(state.status,'urgent');assert.deepEqual(state.candidates,[]);
}
console.log('PASS protected December, personal-only ledger, confirmed-swap restoration, invalid volunteer exclusion');
