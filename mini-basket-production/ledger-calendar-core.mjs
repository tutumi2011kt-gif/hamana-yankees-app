// Calendar cancellation and ledger persistence share one Firestore transaction.
export function calendarState(day){
 return {type:day?.type??null,ownerId:day?.ownerId??null,
  confirmedSubstituteId:day?.confirmedSubstituteId??null,
  ledgerCancellationRevision:day?.ledgerCancellationRevision??null};
}
export function stableSignature(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stableSignature).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableSignature(value[k])).join(',')+'}';
}
export function planLedgerCalendar({date,day,prior,record,revision}){
 const linked=!!prior?.calendarBefore;
 if(linked&&stableSignature(calendarState(day))!==stableSignature(prior.calendarAfter))
  throw Error('中止後に日別予定が変更されています。再読み込みして管理者間で確認してください');
 const original=linked?prior.calendarBefore:calendarState(day);
 const cancel=record?.status==='cancelled'&&['game','rest'].includes(record.reason);
 if((linked||cancel)&&date<'2027-01-01')throw Error('2026年12月の確定当番表は変更できません');
 if(record?.status==='completed'&&original.type!=='practice')throw Error('試合・休みは実施回数に含めません');
 if(record&&original.type==='practice'&&original.ownerId&&record.scheduledOwnerId!==original.ownerId)
  throw Error('元担当者が日別当番表と一致しません');
 if(cancel){
  if(!['practice','game','rest'].includes(original.type))throw Error('日別予定の種別を確認できません');
  const after={type:record.reason,ownerId:null,confirmedSubstituteId:null,ledgerCancellationRevision:revision};
  return {dayPatch:after,calendarBefore:original,calendarAfter:after};
 }
 return {dayPatch:linked?original:null,calendarBefore:null,calendarAfter:null};
}
export async function persistLedger({api,db,teamId,uid,date,record,expected,expectedDay,authMatches=()=>true}){
 const {doc,collection,runTransaction,serverTimestamp}=api;
 const root='teams/'+teamId,month=date.slice(0,7);
 const ledgerRef=doc(db,root+'/dutyLedger/'+date),dayRef=doc(db,root+'/months/'+month+'/days/'+date);
 const auditRef=doc(collection(db,root+'/dutyLedgerAudit'));
 return runTransaction(db,async tx=>{
  const [admin,meta,day,prior]=await Promise.all([
   tx.get(doc(db,'admins',uid)),tx.get(doc(db,root+'/months/'+month)),tx.get(dayRef),tx.get(ledgerRef)
  ]);
  if(!admin.exists()||admin.data().enabled!==true||!authMatches())throw Error('管理者権限を確認できません');
  if(!meta.exists()||!day.exists())throw Error('当番表にこの日がありません');
  const previous=prior.exists()?prior.data():null;
  if(stableSignature(previous)!==stableSignature(expected??null))throw Error('ほかの端末で台帳が変更されました。再読み込みしてください');
  if(stableSignature(calendarState(day.data()))!==stableSignature(calendarState(expectedDay)))throw Error('別端末で日別予定が変更されました。再読み込みしてください');
  if(!record&&!previous)throw Error('取り消す台帳記録がありません');
  const revision=Number(previous?.revision??0)+1;
  const plan=planLedgerCalendar({date,day:day.data(),prior:previous,record,revision});
  if(plan.dayPatch)tx.update(dayRef,plan.dayPatch);
  if(record)tx.set(ledgerRef,{...record,calendarBefore:plan.calendarBefore,calendarAfter:plan.calendarAfter,
   revision,updatedBy:uid,updatedAt:serverTimestamp()});
  else tx.delete(ledgerRef);
  tx.set(auditRef,{action:record?'upsert':'delete',date,previous,next:record,
   calendarBefore:calendarState(day.data()),calendarAfter:plan.dayPatch??calendarState(day.data()),
   revision,updatedBy:uid,updatedAt:serverTimestamp()});
 });
}
