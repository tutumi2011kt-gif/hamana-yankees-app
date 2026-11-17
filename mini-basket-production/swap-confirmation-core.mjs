// Interventions are administrator decisions, never automatic assignments.
// Original day.ownerId MUST remain unchanged. Confirmed substitute is a separate field.
import {isValidDayOfMonth,allowedAnswerKind} from './parent-input-core.mjs';
export const SWAP_FIRST_MONTH='2027-01';
export const SWAP_LAST_MONTH='2027-11';

export function swapState(day,answers=[],members=[]){
 const realDay=day?.type==='practice'&&typeof day.ownerId==='string'&&day.ownerId.length>0;
 if(!realDay)return {status:'not-applicable',needsSwap:false,candidates:[],confirmedId:null};
 const marks=Array.isArray(answers)?answers.filter(a=>a?.date===day.date):[];
 const needsSwap=marks.some(a=>a.memberId===day.ownerId&&a.kind==='x');
 const active=(id)=>{
  if(!Array.isArray(members)||!members.length)return true; // Public viewer only uses published marks.
  const m=members.find(x=>x.id===id);
  return !!m&&m.status==='active'&&(m.startDate??m.start??'9999-12-31')<=day.date
   &&(!(m.endDate??m.end)||(m.endDate??m.end)>=day.date);
 };
 const candidates=[...new Set(marks.filter(a=>
  a.kind==='o'&&a.memberId!==day.ownerId&&typeof a.memberId==='string'&&active(a.memberId)
 ).map(a=>a.memberId))].sort();
 const confirmedId=typeof day.confirmedSubstituteId==='string'&&day.confirmedSubstituteId?day.confirmedSubstituteId:null;
 return {
  status:confirmedId?'confirmed':needsSwap?(candidates.length?'candidates':'urgent'):'normal',
  needsSwap,candidates,confirmedId,
  confirmedStillValid:!!confirmedId&&needsSwap&&candidates.includes(confirmedId)
 };
}
export function validateSwapConfirmation({month,publication,day,answers,members,candidateId}){
 if(typeof month!=='string'||month<SWAP_FIRST_MONTH||month>SWAP_LAST_MONTH||!isValidDayOfMonth(month,day?.date))throw Error('交代操作の対象月・日付が不正です');
 if(publication!=='published')throw Error('管理者が公開済みにした月だけ交代を確定できます');
 if(!day||day.type!=='practice'||!day.ownerId)throw Error('試合・休み・担当者未設定の日は交代できません');
 if(typeof candidateId!=='string'||!candidateId||candidateId===day.ownerId)throw Error('元担当者以外の交代候補を選んでください');
 const state=swapState(day,answers,members);
 if(!state.needsSwap)throw Error('元担当者の×回答がないため交代を確定できません');
 if(!state.candidates.length)throw Error('○候補が0人のため、自動割当も交代確定もできません');
 if(!state.candidates.includes(candidateId))throw Error('その人の○回答または在籍が確認できません');
 if(!allowedAnswerKind({kind:'o',ownerId:day.ownerId,memberId:candidateId,dayType:day.type}))throw Error('○回答を確認できません');
 if(state.confirmedId)throw Error('すでに交代確定済みです。修正は一度解除してください');
 return {originalOwnerId:day.ownerId,confirmedSubstituteId:candidateId};
}
export function validateSwapUndo({month,publication,day}){
 if(typeof month!=='string'||month<SWAP_FIRST_MONTH||month>SWAP_LAST_MONTH||!isValidDayOfMonth(month,day?.date))throw Error('交代解除の対象月・日付が不正です');
 if(publication!=='published'||day.type!=='practice'||!day.ownerId||!day.confirmedSubstituteId)throw Error('解除対象の確定交代はありません');
 return {originalOwnerId:day.ownerId,previousSubstituteId:day.confirmedSubstituteId};
}
export function canEditSwapAnswer(day){
 // Parent write permissions (once designed and tested) must enforce this too,
 // using server-side Firestore security rules, not only the UI.
 return !day?.confirmedSubstituteId;
}
