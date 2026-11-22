// Manager-only, pure, READ-ONLY forecast for Dec 2026 through Nov 2027.
// A provisional assignment is NOT a completed duty or a published parent month.
// The caller fetches existing month docs; this module never writes to Firebase.
import {preliminaryPracticeDays} from './month-rollover-core.mjs';
import {proposeFairDraft,adjustedDutyCounts} from './admin-fairness-core.mjs';

export const ANNUAL_FIRST='2026-12';
export const ANNUAL_LAST='2027-11';
export const ANNUAL_MONTHS=Object.freeze([
 '2026-12','2027-01','2027-02','2027-03','2027-04','2027-05',
 '2027-06','2027-07','2027-08','2027-09','2027-10','2027-11'
]);

// source[month] = {exists: boolean, rows: array}. Missing Feb-Nov may be
// predicted in memory, but existing stored months are never overwritten.
export function forecastAnnualPlan({source,members,records,corrections={},today,localDraft=null}){
 if(!source||!Array.isArray(members)||!Array.isArray(records)||
  typeof today!=='string')throw Error('年間当番予測の入力が不正です');
 const byMonth={},predicted=[],unknown=[],warnings=[],priorPlans=[];
 for(const month of ANNUAL_MONTHS){
  const found=source[month];
  if(!found||typeof found.exists!=='boolean'){
   unknown.push(month+'（読み取り未完了）');continue;
  }
  let rows=[];
  if(found.exists){
   rows=(found.rows||[]).map(r=>({...r})).sort((a,b)=>a.date.localeCompare(b.date));
   if(!rows.length)warnings.push(month+'：保存済みの月に日別データがありません');
  }else if(month>='2027-02'&&month<='2027-11'){
   if(localDraft?.month===month&&Array.isArray(localDraft.rows)){
    rows=localDraft.rows.map(r=>({...r}));
   }else{
    const base=preliminaryPracticeDays(month);
    const proposal=proposeFairDraft({month,days:base,members,records,corrections,today,priorPlans});
    const allocation=new Map(proposal.updates.map(r=>[r.date,r.to]));
    rows=base.map(r=>({...r,ownerId:allocation.get(r.date)??null,
     activityVerified:false,confirmedSubstituteId:null}));
    warnings.push(...proposal.warnings);
   }
   predicted.push(month);
  }else{
   unknown.push(month+'（保存済み当番表なし）');
  }
  byMonth[month]=rows;
  priorPlans.push(...rows);
 }
 return {byMonth,predicted,unknown,warnings};
}

export function summarizeAnnualCounts({members,records,corrections={},today,source,selectedMonth,localDraft=null}){
 const plan=forecastAnnualPlan({source,members,records,corrections,today,localDraft});
 const memberIds=members.map(m=>m.id);
 const totals=adjustedDutyCounts(memberIds,records,corrections,'2027-12');
 const current=Object.fromEntries(memberIds.map(id=>[id,0]));
 const future=Object.fromEntries(memberIds.map(id=>[id,0]));
 const canceledDates=new Set(records.filter(r=>r.status==='cancelled').map(r=>r.date));
 const completedDates=new Set(records.filter(r=>r.status==='completed').map(r=>r.date));
 let missingOwner=0,unrecordedPast=0;
 for(const month of ANNUAL_MONTHS){
  for(const row of plan.byMonth[month]||[]){
   if(row.type!=='practice')continue;
   if(row.ownerId&&Object.prototype.hasOwnProperty.call(current,row.ownerId)&&
     month===selectedMonth&&!canceledDates.has(row.date))current[row.ownerId]++;
   if(row.date<today){
    if(!completedDates.has(row.date)&&!canceledDates.has(row.date))unrecordedPast++;
    continue;
   }
   if(completedDates.has(row.date)||canceledDates.has(row.date))continue;
   if(!row.ownerId){missingOwner++;continue;}
   if(Object.prototype.hasOwnProperty.call(future,row.ownerId))future[row.ownerId]++;
  }
 }
 return {
  selectedMonth:current,completed:totals.effective,recorded:totals.counts,
  future,overall:Object.fromEntries(memberIds.map(id=>[id,totals.effective[id]+future[id]])),
  carry:totals.carry,unresolved:totals.unresolved||[],
  predicted:plan.predicted,unknown:plan.unknown,warnings:plan.warnings,
  missingOwner,unrecordedPast,asOf:today,byMonth:plan.byMonth
 };
}
