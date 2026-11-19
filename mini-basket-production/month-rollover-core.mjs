// 月初ロックと3か月先カレンダー生成の共通・副作用なしロジック。
// All boundaries are JST (UTC+09:00), not the browser's local clock.
// Example: 2026-12-01 00:00 JST locks 2027-01 and generates 2027-03.
export function validMonth(month){
 return typeof month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
export function addMonths(month,delta){
 if(!validMonth(month)||!Number.isInteger(delta))throw Error('月または移動月数が不正です');
 const [year,m]=month.split('-').map(Number);
 return new Date(Date.UTC(year,m-1+delta,1)).toISOString().slice(0,7);
}
export function jstMonthStartMillis(month){
 if(!validMonth(month))throw Error('月が不正です');
 return Date.parse(month+'-01T00:00:00+09:00');
}
export function jstInputOpenMillis(targetMonth){
 // The month becomes eligible to open to parents 3 months before the activity month.
 // It remains unavailable until an administrator reviews and publishes the plan.
 return jstMonthStartMillis(addMonths(targetMonth,-3));
}
export function jstInputCutoffMillis(targetMonth){
 // Parents cannot input from 00:00 JST on the first day of the month
 // IMMEDIATELY preceding the target month.
 return jstMonthStartMillis(addMonths(targetMonth,-1));
}
export function monthlyRolloverPlan(currentMonth){
 if(!validMonth(currentMonth))throw Error('対象月が不正です');
 return {
  startOfMonthMillis:jstMonthStartMillis(currentMonth),
  lockMonth:addMonths(currentMonth,1),
  createMonth:addMonths(currentMonth,3),
  inputMonths:[addMonths(currentMonth,2),addMonths(currentMonth,3)]
 };
}
export function tokyoCalendarMonth(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('日時が不正です');
 const pieces=Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const parts=Object.fromEntries(pieces.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month;
}
export function preliminaryPracticeDays(targetMonth){
 if(!validMonth(targetMonth))throw Error('対象月が不正です');
 const [y,m]=targetMonth.split('-').map(Number);
 const last=new Date(Date.UTC(y,m,0)).getUTCDate();
 return Array.from({length:last},(_,i)=>{
  const day=i+1,date=targetMonth+'-'+String(day).padStart(2,'0');
  const weekday=new Date(Date.UTC(y,m-1,day)).getUTCDay();
  return {date,weekday,type:'practice',ownerId:null,eventLocation:'',traineeIds:[]};
 }).filter(row=>[0,3,5,6].includes(row.weekday));
}
// Do not publish or auto-assign the generated month.
// No trial "practice" row indicates a verified actual practice day.
