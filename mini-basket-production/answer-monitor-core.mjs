// 保護者回答の監査・要確認フラグ（純粋関数、本人確認そのものではない）。
export function answerAuditEvent({before=null,after=null,knownMembers=[],eventTime=null}){
 if(!before&&!after)throw Error('変更前・変更後の回答がありません');
 const operation=!before?'create':!after?'delete':'update';
 const current=after??before;
 const actorUid=after?.updatedBy??null; // For deletes the actual actor is NOT in the old record.
 const lastRecordedWriterUid=before?.updatedBy??after?.updatedBy??null;
 const memberId=current.memberId??null;
 const kinds={before:before?.kind??null,after:after?.kind??null};
 const known=Array.isArray(knownMembers)?knownMembers:[];
 const crossMember=operation!=='delete'&&known.length>0&&!known.includes(memberId);
 const flags=[];
 if(crossMember)flags.push('one-device-multiple-children');
 if(operation==='delete')flags.push('delete-actor-unverified');
 if(operation==='update'&&before?.updatedBy!==after?.updatedBy)flags.push('writer-uid-changed');
 return {
  date:current.date??null,memberId,operation,kindBefore:kinds.before,kindAfter:kinds.after,
  actorUid,lastRecordedWriterUid,
  eventTime,
  flags,needsReview:flags.some(x=>x==='one-device-multiple-children'||x==='writer-uid-changed')
 };
}
export function auditItemTitle(event){
 const k=event.kindAfter??event.kindBefore??'?';
 const action=event.operation==='delete'?'取消':event.operation==='update'?'変更':'登録';
 return `${event.date||'日付不明'} ${event.memberId||'メンバー不明'} ${k} ${action}`;
}
export function recentSuspiciousAnswers(events){
 return (events||[]).filter(x=>x?.needsReview===true);
}


// Manager-only, read-only fallback for currently saved answers. This does not
// reconstruct changes or deletes and cannot authenticate a selected child.
// Admin corrections may reuse the same admin UID across children; this is a
// review hint, never an automatic finding of impersonation.
export function reviewCurrentAnswerState(answers=[]){
 const rows=Array.isArray(answers)?answers:[];
 const byWriter=new Map();
 for(const a of rows){
  if(typeof a?.updatedBy!=='string'||!a.updatedBy||typeof a?.memberId!=='string')continue;
  if(!byWriter.has(a.updatedBy))byWriter.set(a.updatedBy,new Set());
  byWriter.get(a.updatedBy).add(a.memberId);
 }
 return rows.map(a=>{
  const uid=typeof a?.updatedBy==='string'?a.updatedBy:'';
  const flags=[];
  if(!uid||typeof a?.memberId!=='string'||!a.memberId||!['x','o'].includes(a?.kind))
   flags.push('missing-writer-or-answer');
  if(uid&&byWriter.get(uid)?.size>1)flags.push('one-writer-multiple-children');
  return {...a,flags,needsReview:flags.length>0};
 }).sort((a,b)=>String(a.date??'').localeCompare(String(b.date??''))||String(a.memberId??'').localeCompare(String(b.memberId??'')));
}
