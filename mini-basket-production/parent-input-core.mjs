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
 if(existing&&!uid)return 'blocked';
 // An answer can only be cancelled/edited from the same anonymous Firebase UID.
 if(existing&&existing.updatedBy!==uid)return 'different-device';
 if(existing?.kind===kind)return 'delete';
 return 'set';
}
