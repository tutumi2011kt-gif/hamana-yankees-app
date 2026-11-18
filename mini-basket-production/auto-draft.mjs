import {isDayAllowed,isPreferredWeekday,weekdayOf} from './weekday-conditions.mjs';
import {auditDraft} from './month-draft-core.mjs';

// Only recorded completed duties count. Scheduled duties remain provisional.
export function historyTotals(members,history,month){
 const counts=Object.fromEntries(members.map(m=>[m.id,0]));
 const dates=Object.fromEntries(members.map(m=>[m.id,[]]));
 const carry=Object.fromEntries(members.map(m=>[m.id,0]));
 for(const row of history){
  if(!row.date||row.date.slice(0,7)>=month||!Object.hasOwn(counts,row.ownerId))continue;
  if(row.completed===true&&row.type==='practice'&&!row.cancelled){
   counts[row.ownerId]++;dates[row.ownerId].push(row.date);
  }else if(row.cancelled===true&&row.carryoverResolved!==true)carry[row.ownerId]++;
 }
 return {counts,dates,carry};
}
export function generateAutomaticDraft({month,rows,members,history=[],counts={},carry={},historyDates={},calendarConfirmed=false,preserveExisting=false}){
 if(month<='2026-12')throw Error('2026年12月以前の確定表は自動作成対象外です');
 if(!calendarConfirmed)throw Error('活動予定の確認が必要です');
 // January's existing manual assignments must never be silently overwritten.
 // A future month's explicit "recalculate all" action keeps the prior behavior.
 const blank=rows.map(row=>({...row,ownerId:preserveExisting&&row.type==='practice'?(row.ownerId??null):null}));
 const audit=auditDraft(month,blank,members);
 if(!audit.ok)throw Error(audit.problems.join('\n'));
 if(preserveExisting){
  for(const row of blank.filter(r=>r.type==='practice'&&r.ownerId)){
   const member=members.find(m=>m.id===row.ownerId);
   if(!member||!isDayAllowed(member,row.date,weekdayOf(row.date))
    ||(member.unavailableDates||[]).includes(row.date))
    throw Error(row.date+' の既存担当者が当番条件と矛盾しています。変更せず管理者が確認してください');
  }
 }
 const totals=historyTotals(members,history,month);
 for(const m of members){
  if(counts[m.id]!==undefined)totals.counts[m.id]=counts[m.id];
  if(carry[m.id]!==undefined)totals.carry[m.id]=carry[m.id];
  if(historyDates[m.id])totals.dates[m.id]=historyDates[m.id];
  if(!Number.isInteger(totals.counts[m.id])||totals.counts[m.id]<0||!Number.isInteger(totals.carry[m.id])||totals.carry[m.id]<0)throw Error('実施回数・繰越は0以上の整数で入力してください');
 }
 const candidates=row=>members.filter(m=>isDayAllowed(m,row.date,weekdayOf(row.date))&&!(m.unavailableDates||[]).includes(row.date));
 const work=blank.filter(r=>r.type==='practice'&&!r.ownerId);
 // Scarce weekdays are allocated first. Every comparison keeps hard constraints.
 work.sort((a,b)=>candidates(a).length-candidates(b).length||a.date.localeCompare(b.date));
 const allocated=Object.fromEntries(members.map(m=>[m.id,0]));
 const assignedDates=Object.fromEntries(members.map(m=>[m.id,[...totals.dates[m.id]]]));
 // Existing January owners count towards this month's fairness and spacing.
 for(const row of blank.filter(r=>r.type==='practice'&&r.ownerId)){
  allocated[row.ownerId]++;
  assignedDates[row.ownerId].push(row.date);
 }
 const warnings=[];
 const dayNumber=date=>Date.parse(date+'T00:00:00Z')/86400000;
 const score=(m,row)=>{
  const gaps=assignedDates[m.id].map(date=>Math.abs(dayNumber(date)-dayNumber(row.date)));
  const gap=gaps.length?Math.min(...gaps):30;
  return 100*(totals.counts[m.id]+allocated[m.id])
   +Math.max(0,7-gap)*12
   -Math.min(1,Math.max(0,totals.carry[m.id]-allocated[m.id]))*20
   -(isPreferredWeekday(m,weekdayOf(row.date))?8:0);
 };
 for(const row of work){
  const eligible=candidates(row).sort((a,b)=>score(a,row)-score(b,row)||a.id.localeCompare(b.id));
  if(!eligible.length){warnings.push(row.date+'：条件に合う人がいません');continue;}
  row.ownerId=eligible[0].id;allocated[row.ownerId]++;assignedDates[row.ownerId].push(row.date);
 }
 return {rows:blank,allocated,warnings,status:'awaiting-manager'};
}
