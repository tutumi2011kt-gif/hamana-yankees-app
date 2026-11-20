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
// Rebalance only an EXISTING, unlisted DRAFT month. Never touch confirmed,
// manually verified, published, past, December, games, or rest days.
export function proposeFairDraft({month,days,members,records,corrections={},today,priorPlans=[]}){
 if(!/^2027-(0[1-9]|1[01])$/.test(month)||month<='2027-01')throw Error('未公開の2027年2〜11月だけ対象です');
 if(!Array.isArray(days)||!Array.isArray(members)||!Array.isArray(records)||
  typeof today!=='string')throw Error('将来の当番表データが不足しています');
 const activeIds=members.map(m=>m.id);
 const totals=adjustedDutyCounts(activeIds,records,corrections,month);
 const projected={...totals.effective}, assignedDates=Object.fromEntries(members.map(m=>[m.id,[]]));
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
    const pending=records.filter(r=>r.status==='cancelled'&&r.scheduledOwnerId===m.id&&
      r.carryState==='pending'&&r.date<row.date).length;
    // Carry priority is slightly stronger after the preferred 3-month wait.
    const oldPending=records.filter(r=>r.status==='cancelled'&&r.scheduledOwnerId===m.id&&
      r.carryState==='pending'&&r.date<row.date&&
      number(row.date)-number(r.date)>=84).length;
    return projected[m.id]*100+Math.max(0,7-minGap)*11-
       Math.min(pending,2)*20-Math.min(oldPending,2)*30-
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
