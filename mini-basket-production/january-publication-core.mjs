// January 2027 is a pre-existing manually prepared draft, NOT a monthly auto-generated draft.
// This module is read-only. It cannot deploy, seed, or publish a month.
import {calendarDates,auditDraft} from './month-draft-core.mjs';
import {isDayAllowed} from './weekday-conditions.mjs';

export const JANUARY_PUBLICATION_MONTH='2027-01';

export function timestampMillis(v){
 if(typeof v?.toMillis==='function')return v.toMillis();
 return typeof v==='number'&&Number.isFinite(v)?v:NaN;
}

export function januaryDaySignature(day){
 return JSON.stringify([
  day?.date??null,day?.weekday??null,day?.type??null,day?.ownerId??null,
  day?.eventLocation??'',Array.isArray(day?.traineeIds)?day.traineeIds:null,
  timestampMillis(day?.updatedAt)||null
 ]);
}

export function reviewJanuaryForPublication({month=JANUARY_PUBLICATION_MONTH,meta,days,members,roster,openMillis,cutoffMillis,nowMillis=Date.now()}){
 const errors=[],warnings=[];
 const add=(condition,message)=>{if(!condition)errors.push(message);};
 add(month===JANUARY_PUBLICATION_MONTH,'2027年1月以外は、この画面では公開できません');
 add(meta?.publication==='draft','管理者の下書き状態ではありません');
 add(meta?.inputState==='closed','公開前の下書きは入力受付を閉じた状態である必要があります');
 add(Number.isInteger(meta?.version)&&meta.version>=0,'下書きのバージョンが確認できません');
 add(Number.isFinite(openMillis)&&Number.isFinite(cutoffMillis)&&openMillis<cutoffMillis,'受付開始・締切の日本時間が不正です');
 add(Number.isFinite(nowMillis)&&nowMillis<cutoffMillis,'入力締切がすでに過ぎています。公開前に管理者が締切を確認してください');
 add(Array.isArray(members)&&members.length===12&&new Set(members.map(m=>m.id)).size===12,
  'メンバーが12人ではありません');
 add(Array.isArray(roster?.members)&&roster.members.length===12
  &&new Set(roster.members.map(m=>m.id)).size===12,
  '公開用名簿が12人ではありません');
 add(Array.isArray(roster?.publishedMonths)
  &&!roster.publishedMonths.includes(JANUARY_PUBLICATION_MONTH),
  '1月がすでに公開されているか、公開月一覧が不正です');
 if(Array.isArray(members)&&Array.isArray(roster?.members)&&
    members.length===12&&roster.members.length===12){
  const rosterIds=new Set(roster.members.map(x=>x.id));
  add(members.every(m=>rosterIds.has(m.id)),'公開用名簿と管理者名簿が一致しません');
 }
 const expected=calendarDates(JANUARY_PUBLICATION_MONTH);
 const rows=Array.isArray(days)?days:[];
 add(rows.length===expected.length,'1月の活動日数が一致しません');
 const audit=auditDraft(JANUARY_PUBLICATION_MONTH,rows,Array.isArray(members)?members:[]);
 errors.push(...audit.problems);
 // The draft editor can save an incomplete month, but the publication must be complete.
 add(!audit.warnings.some(message=>message.includes('当番者が未設定')),
  '当番担当者が未設定の日があります');
 warnings.push(...audit.warnings.filter(message=>!message.includes('当番者が未設定')));
 for(const day of rows){
  if(day?.type==='practice'&&day.ownerId){
   const member=members?.find(m=>m.id===day.ownerId);
   add(!!member&&isDayAllowed(member,day.date,day.weekday),day.date+' の担当者の在籍・曜日条件を再確認してください');
  }
 }
 return {
  ok:errors.length===0,errors:[...new Set(errors)],warnings,
  days:expected.length,practice:rows.filter(x=>x?.type==='practice').length,
  game:rows.filter(x=>x?.type==='game').length,rest:rows.filter(x=>x?.type==='rest').length
 };
}

export function januaryPublicationPatch({meta,openMillis,cutoffMillis,nowMillis=Date.now()}){
 if(meta?.publication!=='draft')throw Error('1月は下書きである必要があります');
 if(!Number.isFinite(openMillis)||!Number.isFinite(cutoffMillis)||openMillis>=cutoffMillis
  ||!Number.isFinite(nowMillis)||nowMillis>=cutoffMillis)
  throw Error('入力期間が不正、または締切済みです');
 return {
  publication:'published',scheduleStatus:'provisional-published',scheduleVerified:true,
  inputState:nowMillis>=openMillis?'open':'closed'
 };
}
