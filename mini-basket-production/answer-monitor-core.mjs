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
