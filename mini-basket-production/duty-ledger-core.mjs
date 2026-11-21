// Administrator-only duty completion, cancellation and carry-over ledger.
// A scheduled duty is NOT evidence of completed duty.
// December 9 trainee "sawa" is never counted as a second worker.
import {addMonths,validMonth} from './month-rollover-core.mjs';

export const DUTY_STATUSES=Object.freeze(['completed','cancelled']);
export const CANCEL_REASONS=Object.freeze(['game','rest','personal','other']);
export const CARRY_STATES=Object.freeze(['pending','resolved','none']);
export const LEDGER_START='2026-12-01';
export const LEDGER_END='2027-11-30';

export function validLedgerDate(date){
 if(typeof date!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(date))return false;
 const d=new Date(date+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date;
}
export function eligibleCarryWindow(date){
 if(!validLedgerDate(date))throw Error('繰越元の日付が不正です');
 const source=date.slice(0,7);
 return {from:addMonths(source,1),through:addMonths(source,2)};
}
export function buildDutyLedgerRecord({
 date,status,scheduledOwnerId,actualOwnerId=null,reason=null,carryState=null,
 carryResolvedDate=null,note='',traineeIds=[]
}, memberIds, today){
 if(!validLedgerDate(date)||date<LEDGER_START||date>LEDGER_END)throw Error('台帳対象外の日付です');
 if(!validLedgerDate(today))throw Error('基準日が不正です');
 const valid=new Set(memberIds);
 if(!valid.has(scheduledOwnerId))throw Error('元担当者をメンバー名簿から選んでください');
 if(!DUTY_STATUSES.includes(status))throw Error('実施／中止を選んでください');
 if(typeof note!=='string'||note.length>250)throw Error('備考は250文字以内です');
 if(!Array.isArray(traineeIds)||traineeIds.some(id=>!valid.has(id)||id===scheduledOwnerId))throw Error('見学者の指定が不正です');
 const uniqueTrainees=[...new Set(traineeIds)];
 if(status==='completed'){
  if(date>today)throw Error('未来の当番を実施済みとして記録できません');
  if(!valid.has(actualOwnerId))throw Error('実際に当番を担当した人を選んでください');
  if(reason!==null||carryState!==null||carryResolvedDate!==null)throw Error('実施済みには中止・繰越情報を設定しません');
  return {date,status,scheduledOwnerId,actualOwnerId,reason:null,carryState:null,
   carryEligibleFrom:null,carryEligibleThrough:null,carryResolvedDate:null,note,traineeIds:uniqueTrainees};
 }
 if(actualOwnerId!==null)throw Error('中止日には実施者を記録しません');
 if(!CANCEL_REASONS.includes(reason))throw Error('中止理由を選んでください');
 if(!CARRY_STATES.includes(carryState))throw Error('繰越状態を選んでください');
 if(carryState==='resolved'){
  if(!validLedgerDate(carryResolvedDate)||carryResolvedDate<date)throw Error('繰越解消日が不正です');
  if(carryResolvedDate>today)throw Error('未来の解消日を指定できません');
 }else if(carryResolvedDate!==null)throw Error('繰越解消日は「解消済み」の場合のみ指定できます');
 const window=eligibleCarryWindow(date);
 return {date,status,scheduledOwnerId,actualOwnerId:null,reason,carryState,
  carryEligibleFrom:carryState==='none'?null:window.from,
  carryEligibleThrough:carryState==='none'?null:window.through,
  carryResolvedDate:carryState==='resolved'?carryResolvedDate:null,note,traineeIds:uniqueTrainees};
}
export function validateLedgerRecords(records,memberIds){
 const valid=new Set(memberIds),seen=new Set(),errors=[];
 for(const r of records){
  if(!r||!validLedgerDate(r.date)||r.date<LEDGER_START||r.date>LEDGER_END){errors.push('不正な日付があります');continue;}
  if(seen.has(r.date))errors.push(r.date+' の台帳が重複しています');
  seen.add(r.date);
  if(!valid.has(r.scheduledOwnerId))errors.push(r.date+' の元担当者が不明です');
  if(r.status==='completed'){
   if(!valid.has(r.actualOwnerId)||r.reason!==null)errors.push(r.date+' の実施記録が不正です');
  }else if(r.status==='cancelled'){
   if(r.actualOwnerId!==null||!CANCEL_REASONS.includes(r.reason)||!CARRY_STATES.includes(r.carryState))errors.push(r.date+' の中止記録が不正です');
  }else errors.push(r.date+' の状態が不正です');
 }
 return {ok:errors.length===0,errors};
}
export function ledgerTotals(memberIds,records,targetMonth){
 if(!validMonth(targetMonth))throw Error('割当対象月が不正です');
 const check=validateLedgerRecords(records,memberIds);
 if(!check.ok)throw Error(check.errors.join('／'));
 const counts=Object.fromEntries(memberIds.map(id=>[id,0]));
 const carry=Object.fromEntries(memberIds.map(id=>[id,0]));
 const historyDates=Object.fromEntries(memberIds.map(id=>[id,[]]));
 const upcoming=[],overdue=[],unresolved=[];
 for(const r of records){
  if(r.date.slice(0,7)>=targetMonth)continue; // no future/same-month record can bias the draft
  if(r.status==='completed'){
   counts[r.actualOwnerId]++;historyDates[r.actualOwnerId].push(r.date);
  }else if(r.carryState==='pending'){
   const window=eligibleCarryWindow(r.date);
   unresolved.push({date:r.date,memberId:r.scheduledOwnerId,from:window.from,through:window.through});
   if(targetMonth<window.from)upcoming.push(r.date);
   else {
    carry[r.scheduledOwnerId]++;
    if(targetMonth>window.through)overdue.push(r.date);
   }
  }
 }
 for(const dates of Object.values(historyDates))dates.sort();
 return {counts,carry,historyDates,upcoming,overdue,unresolved};
}
export function ledgerSummary(memberIds,records,asOfMonth){
 return ledgerTotals(memberIds,records,asOfMonth);
}
