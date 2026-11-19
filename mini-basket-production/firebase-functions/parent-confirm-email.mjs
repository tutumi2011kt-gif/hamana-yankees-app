// Firebase 2nd gen callable: commit one parent's reviewed date changes atomically,
// then notify the administrator once per confirmation request (not once per calendar tap).
// DEPLOY ONLY after Blaze billing, Gmail SMTP app-password secret and QA verification.
// Does not trust name selection as identity: same pre-existing B-plan limitation.
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getApps,initializeApp} from 'firebase-admin/app';
import nodemailer from 'nodemailer';

if(!getApps().length)initializeApp();
const db=getFirestore();
const TEAM='aritama-mini-basket';
const ADMIN_EMAIL='tutumi2011kt@gmail.com';
const smtpPassword=defineSecret('BASKET_GMAIL_APP_PASSWORD');
const submittedPath='teams/'+TEAM+'/parentSubmissions/';
const validMonth=m=>typeof m==='string'&&/^2027-(0[1-9]|1[01])$/.test(m);
const lockAt=month=>{
 const [year,number]=month.split('-').map(Number);
 const prev=new Date(Date.UTC(year,number-2,1)).toISOString().slice(0,7);
 return Date.parse(prev+'-01T00:00:00+09:00');
};
const toMillis=x=>typeof x?.toMillis==='function'?x.toMillis():NaN;
const mark=k=>k==='x'?'× 当番ができない':'○ 代わりにできる';
const invalid=msg=>{throw new HttpsError('failed-precondition',msg);};
function parsePayload(input){
 if(!input||typeof input!=='object'||!validMonth(input.month)||
    typeof input.memberId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(input.memberId)||
    typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestId)||
    !Array.isArray(input.changes)||input.changes.length<1||input.changes.length>12)
   throw new HttpsError('invalid-argument','月・名前・確認番号・日付を確認してください');
 const seen=new Set();
 const changes=input.changes.map(row=>{
  if(!row||typeof row.date!=='string'||!row.date.startsWith(input.month+'-')||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.date)||
    new Date(row.date+'T00:00:00Z').toISOString().slice(0,10)!==row.date||
    !['x','o'].includes(row.kind)||!['set','delete'].includes(row.operation)||
    (row.operation==='set'&&row.expectedKind!==null)||
    (row.operation==='delete'&&row.expectedKind!==row.kind)||
    seen.has(row.date))throw new HttpsError('invalid-argument','重複または不正な日付があります');
  seen.add(row.date);
  return {date:row.date,kind:row.kind,operation:row.operation,expectedKind:row.expectedKind};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 return {month:input.month,memberId:input.memberId,requestId:input.requestId,changes,
  signature:JSON.stringify([input.month,input.memberId,changes])};
}
async function claimNotification(ref,uid){
 return db.runTransaction(async tx=>{
  const s=await tx.get(ref);
  if(!s.exists||s.data().uid!==uid)return null;
  const status=s.data().notificationStatus;
  if(status!=='pending')return {status,claimed:false,receipt:s.data()};
  tx.update(ref,{notificationStatus:'sending',notificationAttemptedAt:FieldValue.serverTimestamp()});
  return {status:'sending',claimed:true,receipt:s.data()};
 });
}
async function deliverNotification(ref,uid){
 const c=await claimNotification(ref,uid);
 if(!c)return 'unavailable';
 if(!c.claimed)return c.status||'unknown';
 const r=c.receipt;
 const rows=(r.changes||[]).map(row=>
  row.date+'　'+mark(row.kind)+'　'+(row.operation==='delete'?'取消':'登録'));
 const text=[
  '有玉女子ミニバス 当番希望入力の変更通知',
  '',
  '選択されたお子さん：'+r.memberName,
  '対象月：'+r.month,
  '登録された変更：'+rows.length+'件',
  ...rows,
  '',
  '※ 共通URLの名前選択は本人確認ではありません。必要に応じてご本人へ確認してください。',
  '※ ○の申出だけでは交代は確定しません。',
  '処理番号：'+ref.id
 ].join('\n');
 try{
  const transport=nodemailer.createTransport({
   host:'smtp.gmail.com',port:465,secure:true,
   auth:{user:ADMIN_EMAIL,pass:smtpPassword.value()},
   connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000
  });
  await transport.sendMail({
   from:ADMIN_EMAIL,to:ADMIN_EMAIL,
   subject:'【ミニバス当番】'+r.month+' '+r.memberName+'さんの×・○変更（'+rows.length+'件）',
   text
  });
  await ref.update({notificationStatus:'sent',notifiedAt:FieldValue.serverTimestamp()});
  return 'sent';
 }catch(error){
  console.error('Basket parent notification failed',ref.id,String(error?.code||error?.message||error));
  await ref.update({notificationStatus:'failed',notificationErrorCode:String(error?.code||'smtp-error').slice(0,100)});
  return 'failed';
 }
}
export const submitBasketParentChoices=onCall(
 {region:'asia-northeast1',secrets:[smtpPassword],timeoutSeconds:60,maxInstances:3},
 async request=>{
  const uid=request.auth?.uid;
  if(!uid||request.auth?.token?.firebase?.sign_in_provider!=='anonymous')
   throw new HttpsError('unauthenticated','匿名認証が必要です');
  const payload=parsePayload(request.data);
  const {month,memberId,requestId,changes,signature}=payload;
  const base='teams/'+TEAM;
  const receiptRef=db.doc(submittedPath+requestId);
  const monthRef=db.doc(base+'/months/'+month);
  const rosterRef=db.doc(base+'/public/roster');
  const memberRef=db.doc(base+'/members/'+memberId);
  // A short server-side cooldown limits accidental repeated confirmation.
  const rateRef=db.doc(base+'/parentSubmissionRate/'+uid);
  try{
   await db.runTransaction(async tx=>{
    const [existingReceipt,monthSnap,rosterSnap,memberSnap,rateSnap]=await Promise.all([
     tx.get(receiptRef),tx.get(monthRef),tx.get(rosterRef),tx.get(memberRef),tx.get(rateRef)
    ]);
    if(existingReceipt.exists){
     if(existingReceipt.data().uid!==uid||existingReceipt.data().signature!==signature)
      invalid('確認番号が別の入力に使われています');
     return;
    }
    const meta=monthSnap.data(),roster=rosterSnap.data(),person=memberSnap.data();
    const now=Date.now();
    if(!monthSnap.exists||!rosterSnap.exists||!memberSnap.exists||
       meta?.publication!=='published'||meta?.inputState!=='open'||
       !roster?.publishedMonths?.includes(month)||
       !Array.isArray(roster.members)||!roster.members.some(m=>m.id===memberId&&m.status==='active')||
       !Number.isFinite(toMillis(meta.openAt))||!Number.isFinite(toMillis(meta.cutoffAt))||
       now<toMillis(meta.openAt)||now>=toMillis(meta.cutoffAt)||now>=lockAt(month))
      invalid('この月は入力できません。受付期間・公開状態を確認してください');
    if(person.status!=='active'||typeof person.startDate!=='string')
     invalid('選択したメンバーの登録状態を確認してください');
    const last=toMillis(rateSnap.data()?.lastSubmittedAt);
    if(Number.isFinite(last)&&now-last<10000)invalid('連続送信を防ぐため、少し時間をおいてください');
    const verified=[];
    for(const row of changes){
     if(person.startDate>row.date||(person.endDate&&person.endDate<row.date))
      invalid('メンバーの参加対象外の日付があります');
     const dayRef=db.doc(base+'/months/'+month+'/days/'+row.date);
     const answerRef=db.doc(base+'/months/'+month+'/answers/'+row.date+'_'+memberId);
     const [daySnap,answerSnap]=await Promise.all([tx.get(dayRef),tx.get(answerRef)]);
     const day=daySnap.data(),old=answerSnap.data();
     if(!daySnap.exists||day.type!=='practice'||typeof day.ownerId!=='string'||!day.ownerId||
        day.confirmedSubstituteId)invalid('試合・休み・交代確定済みの日は変更できません');
     if(row.operation==='set'){
      if(answerSnap.exists)invalid('別の端末で登録済みです。画面を更新してください');
      if((row.kind==='x')!==(day.ownerId===memberId))
       invalid('×は自分の当番日、○は他の方の当番日に限ります');
     }else if(!answerSnap.exists||old.memberId!==memberId||old.kind!==row.expectedKind||
        old.updatedBy!==uid)invalid('別端末の回答、または変更済みの回答は取り消せません');
     verified.push({...row,answerRef});
    }
    for(const row of verified){
     if(row.operation==='delete')tx.delete(row.answerRef);
     else tx.set(row.answerRef,{
      date:row.date,memberId,kind:row.kind,updatedAt:FieldValue.serverTimestamp(),updatedBy:uid
     });
    }
    tx.create(receiptRef,{
     month,memberId,memberName:person.name||roster.members.find(m=>m.id===memberId)?.name||memberId,
     uid,signature,changes,notificationStatus:'pending',createdAt:FieldValue.serverTimestamp()
    });
    tx.set(rateRef,{lastSubmittedAt:FieldValue.serverTimestamp()},{merge:true});
   });
   const notificationStatus=await deliverNotification(receiptRef,uid);
   return {saved:true,notificationStatus,receiptId:requestId};
  }catch(err){
   if(err instanceof HttpsError)throw err;
   console.error('Basket parent confirm failed',requestId,String(err?.code||err?.message||err));
   throw new HttpsError('internal','保存状態を確認できませんでした。同じ確認番号で再試行してください');
  }
 });
