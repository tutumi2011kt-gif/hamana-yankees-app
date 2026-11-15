// Mini-basket duty: pure scheduling rules (version 0.1).
// No Firebase or browser APIs. All dates are YYYY-MM-DD / YYYY-MM.
export const WEEKDAYS=[0,3,5,6]; // Sun, Wed, Fri, Sat
export const DAY_NAMES=['日','月','火','水','木','金','土'];
export const ROSTER=[
 {id:'yui',name:'ゆい',kana:'ゆい',grade:6,start:'2026-12-01',end:null,days:[3],status:'active'},
 {id:'mia',name:'みあ',kana:'みあ',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'an',name:'あん',kana:'あん',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'mai',name:'まい',kana:'まい',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'nodoka',name:'のどか',kana:'のどか',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'nagisa',name:'なぎさ',kana:'なぎさ',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'sayaka',name:'さやか',kana:'さやか',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'koharu',name:'こはる',kana:'こはる',grade:6,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'sawa',name:'村松さわ',kana:'むらまつさわ',grade:4,start:'2027-01-01',end:null,days:null,status:'active'},
 {id:'wakana',name:'大竹わかな',kana:'おおたけわかな',grade:3,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'kaho',name:'かほ',kana:'かほ',grade:3,start:'2026-12-01',end:null,days:null,status:'active'},
 {id:'haruka',name:'はるか',kana:'はるか',grade:2,start:'2026-12-01',end:null,days:[0,3,5,6],status:'active'}
];
export function monthPlus(month,offset){
 const [y,m]=month.split('-').map(Number);
 const d=new Date(Date.UTC(y,m-1+offset,1));
 return d.toISOString().slice(0,7);
}
export function todayTokyo(now=new Date()){
 const parts=Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const obj=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return obj.year+'-'+obj.month+'-'+obj.day;
}
export function rollingWindow(today){
 const current=today.slice(0,7);
 return {current,lockThrough:monthPlus(current,1),inputMonths:[monthPlus(current,2),monthPlus(current,3)],createMonth:monthPlus(current,3)};
}
export function inputPermission(month,today,publication='published'){
 const r=rollingWindow(today);
 if(month<=r.lockThrough)return 'locked';
 if(!r.inputMonths.includes(month))return 'outside-window';
 if(publication!=='published')return 'awaiting-manager';
 return 'editable';
}
export function dayList(month){
 const [y,m]=month.split('-').map(Number),n=new Date(Date.UTC(y,m,0)).getUTCDate();
 return Array.from({length:n},(_,i)=>({date:month+'-'+String(i+1).padStart(2,'0'),weekday:new Date(Date.UTC(y,m-1,i+1)).getUTCDay()}));
}
export function activeOn(member,date){
 return member.status==='active' && member.start<=date && (!member.end || date<=member.end);
}
export function practices(month,exceptions={}){
 return dayList(month).filter(x=>WEEKDAYS.includes(x.weekday)&&!['試合','休み'].includes(exceptions[x.date]));
}
export function isEligibleForDraft(member,date,weekday,preferences={}){
 if(!activeOn(member,date))return false;
 // null means UNCONFIRMED, not unrestricted; do not silently assign.
 if(!Array.isArray(member.days)||!member.days.includes(weekday))return false;
 const x=preferences[member.id]?.unavailable||[];
 return !x.includes(date);
}
export function buildDraft({month,members=ROSTER,preferences={},counts={},exceptions={}}){
 const assignments={},reasons={},allocated={};
 const work=practices(month,exceptions);
 const eligibleMembers=members.filter(m=>m.status==='active');
 const unconfirmed=eligibleMembers.filter(m=>m.days===null).map(m=>m.name);
 for(const d of work){
  const eligible=eligibleMembers.filter(m=>isEligibleForDraft(m,d.date,d.weekday,preferences));
  if(eligible.length===0){
   assignments[d.date]=null;
   reasons[d.date]='条件が合う候補者がいません。管理者確認が必要です';
   continue;
  }
  eligible.sort((a,b)=>{
   const ap=preferences[a.id]?.preferred||[],bp=preferences[b.id]?.preferred||[];
   const aa=ap.includes(d.date)?0:1,bb=bp.includes(d.date)?0:1;
   if(aa!==bb)return aa-bb;
   const ca=(counts[a.id]||0)+(allocated[a.id]||0),cb=(counts[b.id]||0)+(allocated[b.id]||0);
   if(ca!==cb)return ca-cb;
   return a.kana.localeCompare(b.kana,'ja');
  });
  assignments[d.date]=eligible[0].id;
  allocated[eligible[0].id]=(allocated[eligible[0].id]||0)+1;
 }
 return {month,assignments,reasons,unconfirmedWeekdays:unconfirmed,source:'automatic-draft',status:'awaiting-manager'};
}
// submissions[date][memberId] may be 'x' (unavailable) or 'o' (can cover).
export function swapStatus({date,ownerId,submissions={},members=ROSTER}){
 if(!ownerId)return {status:'unassigned',volunteers:[]};
 const marks=submissions[date]||{};
 if(marks[ownerId]!=='x')return {status:'normal',volunteers:[]};
 const volunteers=members.filter(m=>m.id!==ownerId&&activeOn(m,date)&&marks[m.id]==='o').map(m=>m.id);
 return {status:volunteers.length?'candidate':'urgent',volunteers};
}
export function auditSchedule({month,assignments={},members=ROSTER,preferences={},exceptions={},submissions={},requireResponses=false,responses={}}){
 const blockers=[],warnings=[],info=[];
 const lookup=Object.fromEntries(members.map(m=>[m.id,m]));
 const work=practices(month,exceptions);
 const practiceSet=new Set(work.map(d=>d.date));
 for(const d of work){
  const value=assignments[d.date];
  if(Array.isArray(value)){blockers.push(d.date+'：当番が複数人');continue}
  if(!value){blockers.push(d.date+'：担当者未決定');continue}
  const m=lookup[value];
  if(!m){blockers.push(d.date+'：登録外の担当者');continue}
  if(!activeOn(m,d.date))blockers.push(d.date+'：当番対象期間外 '+m.name);
  if(!Array.isArray(m.days))blockers.push(d.date+'：曜日条件未確認 '+m.name);
  else if(!m.days.includes(d.weekday))blockers.push(d.date+'：曜日条件違反 '+m.name);
  if((preferences[m.id]?.unavailable||[]).includes(d.date))blockers.push(d.date+'：登録済みの×と衝突 '+m.name);
  const swap=swapStatus({date:d.date,ownerId:value,submissions,members});
  if(swap.status==='urgent')blockers.push(d.date+'：交代募集中（○候補0人）');
  if(swap.status==='candidate')blockers.push(d.date+'：交代希望あり・管理者による確定待ち');
 }
 for(const [date,value] of Object.entries(assignments)){
  if(!practiceSet.has(date)&&value)blockers.push(date+'：試合・休みに当番が割り当てられています');
 }
 for(const m of members){
  if(m.status!=='active')continue;
  if(m.days===null)warnings.push(m.name+'：当番可能曜日が未確認');
  if(requireResponses&&responses[m.id]!==true)blockers.push(m.name+'：希望の回答・確認が未完了');
 }
 if(blockers.length===0)info.push('登録済みの禁止条件と割当の整合性はOK');
 return {ok:blockers.length===0,blockers,warnings,info,month};
}
export function check7DayAlert({unavailableAt,volunteers=0,resolved=false,practiseDate,now}){
 if(!unavailableAt||!now||resolved||volunteers>0)return false;
 const start=Date.parse(unavailableAt),current=Date.parse(now);
 if(!Number.isFinite(start)||!Number.isFinite(current)||current-start<7*86400000)return false;
 // A cancellation after the practice day is not actionable.
 if(practiseDate&&practiseDate<todayTokyo(new Date(now)))return false;
 return true;
}
