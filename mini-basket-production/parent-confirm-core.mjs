// Pure draft-selection helpers: a tap does not write to Firestore.
export const MAX_CONFIRM_CHANGES=12;
export function choiceLabel(choice){
 const symbol=choice.kind==='x'?'×':'○';
 return choice.operation==='delete'?symbol+'を取り消す':symbol+'を登録する';
}
export function draftChoiceForTap({date,kind,day,existing,memberId,uid,current=null}){
 if(current){
  if(current.kind!==kind)return {action:'change-mode',choice:current};
  return {action:'unstage',choice:null};
 }
 if(!uid||!memberId||!day||day.type!=='practice'||!day.ownerId||day.confirmedSubstituteId||
    !['x','o'].includes(kind))return {action:'blocked',choice:null};
 if(existing){
  if(existing.memberId!==memberId||existing.updatedBy!==uid)
   return {action:'different-device',choice:null};
  if(existing.kind!==kind)return {action:'blocked',choice:null};
  return {action:'stage',choice:{date,kind,operation:'delete',expectedKind:kind}};
 }
 if(kind==='x'&&day.ownerId!==memberId)return {action:'blocked',choice:null};
 if(kind==='o'&&day.ownerId===memberId)return {action:'blocked',choice:null};
 return {action:'stage',choice:{date,kind,operation:'set',expectedKind:null}};
}
export function normalizeSubmissionChanges(changes){
 if(!Array.isArray(changes)||changes.length<1||changes.length>MAX_CONFIRM_CHANGES)
  throw new Error('一度に確認できる日付は1〜'+MAX_CONFIRM_CHANGES+'件です');
 const used=new Set();
 return changes.map(c=>{
  if(!c||typeof c.date!=='string'||!/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(c.date)||
    !['x','o'].includes(c.kind)||!['set','delete'].includes(c.operation)||
    (c.operation==='set'?c.expectedKind!==null:c.expectedKind!==c.kind)||
    used.has(c.date))throw new Error('登録内容に重複または不正な日付があります');
  used.add(c.date);
  return {date:c.date,kind:c.kind,operation:c.operation,expectedKind:c.expectedKind};
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
