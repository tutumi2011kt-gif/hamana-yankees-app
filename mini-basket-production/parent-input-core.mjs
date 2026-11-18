import {jstInputCutoffMillis,jstInputOpenMillis} from './month-rollover-core.mjs';
// Parent answer UI: pure checks. Firestore Security Rules independently enforce all writes.
export const isValidMonth = m => typeof m==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const isValidDayOfMonth = (month,date) => {
 if(!isValidMonth(month)||typeof date!=='string'||!date.startsWith(month+'-')||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return false;
 const d=new Date(date+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===date;
};
export function canEditMonth(metadata, nowMillis=Date.now()){
 const timestampMillis=t=>typeof t?.toMillis==='function'?t.toMillis():Number.isFinite(t)?t:NaN;
 const open=timestampMillis(metadata?.openAt),close=timestampMillis(metadata?.cutoffAt);
 return metadata?.publication==='published'&&metadata?.inputState==='open'
   &&Number.isFinite(open)&&Number.isFinite(close)&&Number.isFinite(nowMillis)&&nowMillis>=open&&nowMillis<close;
}
// The selected child is *not* authenticated by selecting their name.
export function allowedAnswerKind({kind,ownerId,memberId,dayType}){
 return dayType==='practice'&&Boolean(ownerId&&memberId)&&['x','o'].includes(kind)
   &&(kind==='x'?memberId===ownerId:memberId!==ownerId);
}
export function decideAnswerAction(existing,kind,uid){
 if(!uid)return 'blocked';
 // An answer can only be cancelled/edited from the same anonymous Firebase UID.
 if(existing&&existing.updatedBy!==uid)return 'different-device';
 if(existing?.kind===kind)return 'delete';
 return 'set';
}

// One source of truth for calendar tap targets and the action after a tap.
// A saved ×/○ must remain tappable for cancellation even if its original
// owner assignment has changed; server-side Security Rules still decide.
export function answerTapDecision({day,existing,kind,memberId,uid,canWrite}){
 if(!canWrite||!day||day.type!=='practice'||!day.ownerId||
    day.confirmedSubstituteId||!memberId||!uid)return {enabled:false,action:'blocked'};
 const matchingAnswer=existing?.memberId===memberId&&existing?.kind===kind;
 if(matchingAnswer){
  const action=decideAnswerAction(existing,kind,uid);
  return {enabled:true,action}; // A different device gets an explanation, not a silent disabled button.
 }
 if(!allowedAnswerKind({kind,ownerId:day.ownerId,memberId,dayType:day.type}))
  return {enabled:false,action:'blocked'};
 const action=decideAnswerAction(existing,kind,uid);
 return {enabled:action!=='blocked',action};
}

// While a Firebase transaction is in flight, the same calendar cell must
// remain tappable. Each repeat tap reverses the queued toggle (tap parity).
export function sameAnswerTap(pending,{month,date,person,kind}){
 return !!pending&&pending.month===month&&pending.date===date
  &&pending.person===person&&pending.kind===kind;
}

// Show just-committed answers while onSnapshot lags.
// Overrides are answer-document IDs scoped to one month;
// null represents a successful deletion, an answer object a successful set.
export function overlayParentAnswers(snapshotAnswers,overrides){
 const visible=new Map(snapshotAnswers.map(a=>[a.id||a.date+'_'+a.memberId,a]));
 for(const [id,answer] of overrides){
  if(answer===null)visible.delete(id);
  else visible.set(id,{id,...answer});
 }
 return [...visible.values()];
}

export function defaultCutoffMillis(targetMonth){
 return jstInputCutoffMillis(targetMonth);
}
export function defaultOpenMillis(targetMonth){
 return jstInputOpenMillis(targetMonth);
}
