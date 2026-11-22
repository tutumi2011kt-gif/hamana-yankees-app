// 管理者確認済みの当番曜日（2026-11-22 更新）。曜日番号: 日0・水3・金5・土6
// "days" is allowed for regular automatic drafts. Nothing in here rewrites confirmed past duties.
// 村松さわ: 2027-01-01開始、水・土・日。金曜は絶対不可。
export const WEEKDAY_PROFILE_VERSION='2026-11-22';
export const YUI_SUNDAY_START='2027-04-01';
export const WEEKDAYS=[0,3,5,6];
export const WEEKDAY_LABELS={0:'日',3:'水',5:'金',6:'土'};
export const WEEKDAY_UPDATES=Object.freeze({
 wakana:{days:[0,3,5,6],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'全曜日可'},
 mia:{days:[6],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'土曜日以外は絶対不可'},
 yui:{days:[3],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'2027年3月までは水曜のみ。2027年4月以降は水曜・日曜（通常仮割当）'},
 an:{days:[0,6],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'土・日曜日以外は絶対不可'},
 mai:{days:[0,3,5,6],preferredWeekdays:[3],weekdayRule:'soft',weekdayNote:'水曜日を優先。他の曜日も可能'},
 koharu:{days:[3],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'水曜日以外は絶対不可'},
 nagisa:{days:[3,5],preferredWeekdays:[3,5],weekdayRule:'conditional-weekend',weekdayNote:'原則水・金。土日は2〜3か月前の事前確認・明示承認が必要',approvedWeekendDates:[]},
 nodoka:{days:[0,3,5],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'土曜日は絶対不可'},
 sayaka:{days:[0,3,5,6],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'全曜日可'},
 haruka:{days:[0,3,5,6],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'全曜日可'},
 kaho:{days:[3,5],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'水・金曜日以外は絶対不可'},
 sawa:{days:[0,3,6],preferredWeekdays:[],weekdayRule:'hard',weekdayNote:'水・土・日曜日のみ。当番開始は2027年1月。金曜日は絶対不可'}
});
export const PROFILE_IDS=Object.keys(WEEKDAY_UPDATES);
export function weekdayOf(date){
 if(typeof date!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date))return null;
 const d=new Date(date+'T00:00:00Z');
 return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==date?null:d.getUTCDay();
}
export function activeOnDate(m,date){
 const start=m?.startDate||m?.start;
 const end=m?.endDate??m?.end??null;
 return m?.status==='active'&&typeof start==='string'&&start<=date&&(!end||end>=date);
}
export function isDayAllowed(member,date,weekday=weekdayOf(date)){
 if(!activeOnDate(member,date)||!WEEKDAYS.includes(weekday))return false;
 const days=member.days;
 if(!Array.isArray(days))return false; // 未確認は絶対に割り当てない
 // Yui's fixed historic Wednesday rule changes only for automatic assignment
 // dates from April 2027 onward. Leave parent volunteer ○ independent.
 // Do not change any stored 2026/12 or 2027/01-03 assignment data.
 if(member.id==='yui'){
  return weekday===3||(date>=YUI_SUNDAY_START&&weekday===0);
 }
 if(days.includes(weekday))return true;
 // 例外はなぎさの明示確認済み日だけ。絶対条件は絶対に緩めない。
 return member.id==='nagisa'&&member.weekdayRule==='conditional-weekend'
    &&(weekday===0||weekday===6)
    &&Array.isArray(member.approvedWeekendDates)
    &&member.approvedWeekendDates.includes(date);
}
export function isPreferredWeekday(member,weekday){
 const pref=member?.preferredWeekdays;
 return Array.isArray(pref)&&pref.length>0&&pref.includes(weekday);
}
export function profileMatches(member,profile){
 const norm=x=>JSON.stringify(Array.isArray(x)?[...x].sort((a,b)=>a-b):x);
 return norm(member?.days)===norm(profile.days)
   &&norm(member?.preferredWeekdays??[])===norm(profile.preferredWeekdays)
   &&member?.weekdayRule===profile.weekdayRule
   &&member?.weekdayNote===profile.weekdayNote
   &&(profile.weekdayRule!=='conditional-weekend'||Array.isArray(member?.approvedWeekendDates));
}
export function profileSummary({id,name,days,preferredWeekdays,weekdayRule,weekdayNote}){
 const labels=days===null?'確認中':days.map(day=>WEEKDAY_LABELS[day]+'曜').join('・');
 const prefs=preferredWeekdays?.length?'／希望 '+preferredWeekdays.map(day=>WEEKDAY_LABELS[day]).join('・')+'曜':'';
 return (name||id)+'：'+labels+prefs+'（'+(weekdayNote||weekdayRule||'')+'）';
}
