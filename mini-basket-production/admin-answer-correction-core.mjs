// Manager-only corrections for anonymous responses; not a parent identity mechanism.
// Admin can fix an answer from a new phone even if the original anonymous UID was lost.
import {isValidDayOfMonth,allowedAnswerKind} from './parent-input-core.mjs';
export function validateAdminCorrection({month,publication,day,member,kind,action,existing}){
 if(typeof month!=='string'||month<'2027-01'||month>'2027-11'
    ||!isValidDayOfMonth(month,day?.date))throw Error('対象月または日付が不正です');
 if(publication!=='published')throw Error('未公開カレンダーの回答を変更できません');
 if(day.type!=='practice'||!day.ownerId||day.confirmedSubstituteId)throw Error('試合・休み・交代確定済みの日は修正できません');
 if(!member||member.status!=='active'||(member.startDate??member.start??'9999-12-31')>day.date
   ||((member.endDate??member.end??null)&&((member.endDate??member.end)<day.date)))
  throw Error('この日には在籍していないメンバーです');
 if(action==='remove'){
  if(!existing||existing.memberId!==member.id||existing.date!==day.date)
   throw Error('削除対象の回答がありません');
  return {action:'remove',date:day.date,memberId:member.id};
 }
 if(action!=='set'||!allowedAnswerKind({kind,ownerId:day.ownerId,memberId:member.id,dayType:day.type}))
  throw Error('×は元担当者のみ、○は元担当者以外のみ入力できます');
 return {action:'set',date:day.date,memberId:member.id,kind};
}
export function signatureAnswer(answer){
 if(!answer)return null;
 const ts=answer.updatedAt?.toMillis?.()??answer.updatedAt??null;
 return JSON.stringify({
  date:answer.date,memberId:answer.memberId,kind:answer.kind,
  updatedBy:answer.updatedBy??null,updatedAt:ts
 });
}
