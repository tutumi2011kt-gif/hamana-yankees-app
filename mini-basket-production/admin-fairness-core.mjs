import {isDayAllowed,isPreferredWeekday} from './weekday-conditions.mjs';
import {ledgerTotals} from './duty-ledger-core.mjs';

// Admin-only display correction: preserves the source duty-ledger records.
// The manual correction is distinct from a real completion entry.
export function adjustedDutyCounts(memberIds,records,corrections,targetMonth='2027-12'){
 const raw=ledgerTotals(memberIds,records,targetMonth);
 const effective={};
 for(const id of memberIds){
  const delta=corrections[id]??0;
  if(!Number.isInteger(delta)||Math.abs(delta)>50)throw Error('回数補正が不正です: '+id);
  effective[id]=raw.counts[id]+delta;
  if(effective[id]<0)throw Error('回数がマイナスになっています: '+id);
 }
 return {...raw,effective};
}
export function shouldMarkGame({date,day,record,month}){
 if(typeof date!=='string'||date<'2027-01-01'||date>'2027-11-30'||
  date.slice(0,7)!==month||!day||day.type!=='practice')throw Error('対象月の練習日だけ試合にできます');
 if(record?.status==='completed')throw Error('実施済みの当番を試合として取り消せません。先に実績記録を確認してください');
 if(record?.status==='cancelled')throw Error('既に中止記録があります。実績台帳で確認してください');
 if(day.confirmedSubstituteId)throw Error('交代確定済みのため、先に管理者で交代確定を確認してください');
 return {date,originalOwnerId:day.ownerId||null,carryPending:Boolean(day.ownerId)};
}
// Only reverse an explicitly recorded game conversion. Keep unrelated games
// and completed/cleared carryovers intact instead of guessing prior duties.
export function shouldRestorePractice({date,day,record,month}){
 if(typeof date!=='string'||date<'2027-01-01'||date>'2027-11-30'||
  date.slice(0,7)!==month||day?.type!=='game')
  throw Error('2027年1〜11月の試合日だけが対象です');
 if(record){
  if(record.status!=='cancelled'||record.reason!=='game'||
   record.carryState!=='pending'||record.carryResolvedDate)
   throw Error('繰越が処理済み、または試合以外の記録です。台帳で確認してください');
  const before=record.calendarBefore,after=record.calendarAfter;
  if(before?.type!=='practice'||!before.ownerId||
   record.scheduledOwnerId!==before.ownerId||
   after?.type!=='game'||after.ownerId!==null||
   day.ownerId!=null||day.ledgerCancellationRevision!==after.ledgerCancellationRevision)
   throw Error('試合への変更前の担当者情報が確認できません。台帳で確認してください');
  if(day.gameBefore)throw Error('試合の記録が重複しています。台帳で確認してください');
  return {origin:'ledger',originalOwnerId:before.ownerId};
 }
 const before=day.gameBefore;
 if(before?.type!=='practice'||before.ownerId!=null||
  day.ownerId!=null||day.confirmedSubstituteId!=null||
  (day.ledgerCancellationRevision??null)!==(before.ledgerCancellationRevision??null))
  throw Error('元の練習・当番情報が確認できない試合です。自動で戻さず管理者が確認してください');
 return {origin:'unassigned',originalOwnerId:null};
}

// Rebalance only an EXISTING, unlisted DRAFT month. Never touch confirmed,
// manually verified, published, past, December, games, or rest days.
export function proposeFairDraft({month,days,members,records,corrections={},today,priorPlans=[]}){
 if(!/^2027-(0[1-9]|1[01])$/.test(month)||month<='2027-01')throw Error('未公開の2027年2〜11月だけ対象です');
 if(!Array.isArray(days)||!Array.isArray(members)||!Array.isArray(records)||
  typeof today!=='string')throw Error('将来の当番表データが不足しています');
 const activeIds=members.map(m=>m.id);
 const totals=adjustedDutyCounts(activeIds,records,corrections,month);
 const projected={...totals.effective}, assignedDates=Object.fromEntries(members.map(m=>[m.id,[...(totals.historyDates[m.id]||[])]]));
 for(const row of priorPlans){
  if(row.type==='practice'&&row.ownerId&&row.date<month+'-01'&&row.date>=today&&
    Object.prototype.hasOwnProperty.call(projected,row.ownerId)){
   projected[row.ownerId]++;assignedDates[row.ownerId].push(row.date);
  }
 }
 const list=days.map(d=>({...d}));
 for(const row of list){
  if(row.type==='practice'&&row.ownerId&&(row.activityVerified===true||row.date<=today)){
   if(Object.prototype.hasOwnProperty.call(projected,row.ownerId)){
    projected[row.ownerId]++;assignedDates[row.ownerId].push(row.date);
   }
  }
 }
 const unavailable=(m,d)=>Array.isArray(m.unavailableDates)&&m.unavailableDates.includes(d);
 const eligible=r=>members.filter(m=>isDayAllowed(m,r.date,r.weekday)&&!unavailable(m,r.date));
 const editable=list.filter(r=>r.date>today&&r.type==='practice'&&!r.activityVerified&&!r.confirmedSubstituteId);
 editable.sort((a,b)=>eligible(a).length-eligible(b).length||a.date.localeCompare(b.date));
 const updates=[],warnings=[];
 const number=date=>Date.parse(date+'T00:00:00Z')/86400000;
 for(const row of editable){
  const candidates=eligible(row);
  if(!candidates.length){warnings.push(row.date+'：曜日・在籍期間の条件を満たすメンバーがいません');continue;}
  candidates.sort((a,b)=>{
   const score=m=>{
    const distances=assignedDates[m.id].map(d=>Math.abs(number(d)-number(row.date)));
    const minGap=distances.length?Math.min(...distances):30;
    // The first possible month after cancellation takes priority, then the next
    // month. A planned replacement does not clear the ledger carryover: only a
    // recorded completed duty can do that. But it stops repeated priority here.
    const outstanding=records.filter(r=>{
     if(r.status!=='cancelled'||r.scheduledOwnerId!==m.id||r.carryState!=='pending')return false;
     if(r.date.slice(0,7)>=row.date.slice(0,7))return false;
     return !assignedDates[m.id].some(d=>d.slice(0,7)>r.date.slice(0,7)&&d<row.date);
    });
    const carryPriority=outstanding.reduce((best,r)=>{
     const gap=(Number(row.date.slice(0,4))-Number(r.date.slice(0,4)))*12+
      Number(row.date.slice(5,7))-Number(r.date.slice(5,7));
     const weight=gap===1?90:gap===2?80:Math.max(40,70-5*(gap-3));
     return Math.max(best,weight);
    },0);
    return projected[m.id]*100+Math.max(0,7-minGap)*11-carryPriority-
       (isPreferredWeekday(m,row.weekday)?6:0);
   };
   return score(a)-score(b)||a.id.localeCompare(b.id);
  });
  const next=candidates[0].id;
  if(row.ownerId!==next)updates.push({date:row.date,from:row.ownerId||null,to:next});
  projected[next]++;assignedDates[next].push(row.date);
 }
 return {month,updates,warnings,projected};
}
