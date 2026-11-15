// Pure draft calendar checks. No automatic parent assignment and no inferred game dates.
export const DRAFT_MONTH='2027-01';
export const VALID_TYPES=['practice','game','rest'];
export const DAY_NAMES=['日','月','火','水','木','金','土'];
export const ACTIVE_WEEKDAYS=[0,3,5,6];

export function calendarDates(month=DRAFT_MONTH){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Invalid month');
 const [y,m]=month.split('-').map(Number);
 const last=new Date(Date.UTC(y,m,0)).getUTCDate();
 return Array.from({length:last},(_,i)=>{
  const date=month+'-'+String(i+1).padStart(2,'0');
  const weekday=new Date(Date.UTC(y,m-1,i+1)).getUTCDay();
  return {date,weekday};
 }).filter(d=>ACTIVE_WEEKDAYS.includes(d.weekday));
}
export function emptyDraft(month=DRAFT_MONTH){
 return calendarDates(month).map(({date,weekday})=>({date,weekday,type:'practice',ownerId:null,eventLocation:'',traineeIds:[]}));
}
export function normalizeMember(m){
 return {id:m.id,name:m.name,kana:m.kana||m.name,days:Array.isArray(m.days)?m.days:null,
  start:m.startDate||m.start||'9999-12-31',end:m.endDate??m.end??null,status:m.status};
}
export function eligibleManualOwner(member,date){
 return member?.status==='active'
   &&typeof member.start==='string'&&member.start<=date
   &&(!member.end || member.end>=date);
}
export function auditDraft(month,rows,members){
 const expected=calendarDates(month);
 const roster=Object.fromEntries(members.map(m=>[m.id,m]));
 const problems=[],warnings=[];
 if(rows.length!==expected.length)problems.push('対象の水・金・土・日の日数が一致しません');
 const seen=new Set();
 for(const row of rows){
  if(seen.has(row.date))problems.push(row.date+' が重複しています');seen.add(row.date);
  const expectedDay=expected.find(x=>x.date===row.date);
  if(!expectedDay)problems.push(row.date+' は対象外の日付です');
  if(expectedDay&&expectedDay.weekday!==row.weekday)problems.push(row.date+' の曜日が一致しません');
  if(!VALID_TYPES.includes(row.type))problems.push(row.date+' の予定区分が不正です');
  if(row.type==='practice'){
   if(!row.ownerId)warnings.push(row.date+' の当番者が未設定');
   else{
    const owner=roster[row.ownerId];
    if(!owner)problems.push(row.date+' の担当者が名簿にいません');
    else{
     if(!eligibleManualOwner(owner,row.date))problems.push(row.date+' の担当者は当番対象外');
     if(owner.days===null)warnings.push(row.date+'：'+owner.name+'の当番可能曜日が未確認');
     else if(!owner.days.includes(row.weekday))warnings.push(row.date+'：'+owner.name+'の曜日条件を要確認');
    }
   }
  }else if(row.ownerId)problems.push(row.date+' の試合・休みには担当者を設定できません');
 }
 for(const d of expected)if(!seen.has(d.date))problems.push(d.date+' が存在しません');
 return {ok:problems.length===0,problems,warnings,practice:rows.filter(r=>r.type==='practice').length,
   game:rows.filter(r=>r.type==='game').length,rest:rows.filter(r=>r.type==='rest').length};
}
