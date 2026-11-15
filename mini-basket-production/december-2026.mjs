// 2026年12月：保護者と確認済みの実当番表。体験版の架空割当は使用しません。
// 一度のみの初期登録用。ここに「仮に」割当を追加しないでください。
import {dayList,WEEKDAYS} from './core.mjs';
export const decemberAssignments = Object.freeze({
 "2026-12-02":"yui",
 "2026-12-04":"kaho",
 "2026-12-05":"mia",
 "2026-12-06":"wakana",
 "2026-12-09":"koharu",
 "2026-12-11":"nagisa",
 "2026-12-12":"an",
 "2026-12-13":"nodoka",
 "2026-12-16":"mai",
 "2026-12-18":"nodoka",
 "2026-12-19":"sayaka",
 "2026-12-20":"an",
 "2026-12-23":"haruka",
 "2026-12-25":"wakana",
 "2026-12-30":"koharu"
});
export const decemberGames=Object.freeze({
 "2026-12-26":"さわやかアリーナ",
 "2026-12-27":"竜洋"
});
export function buildDecember2026(){
 const work=dayList('2026-12').filter(d=>WEEKDAYS.includes(d.weekday));
 const all=new Set(work.map(d=>d.date));
 if(Object.keys(decemberAssignments).length!==15||Object.keys(decemberGames).length!==2||all.size!==17){
  throw Error('2026年12月の当番日数または試合日数が一致しません');
 }
 const days=work.map(({date,weekday})=>{
  if(decemberGames[date])return {date,weekday,type:'game',ownerId:null,eventLocation:decemberGames[date],traineeIds:[]};
  const ownerId=decemberAssignments[date];
  if(!ownerId)throw Error(date+' の担当者が未登録です');
  return {date,weekday,type:'practice',ownerId,traineeIds:date==='2026-12-09'?['sawa']:[]};
 });
 const ids=days.filter(d=>d.type==='practice').map(d=>d.ownerId);
 if(ids.filter(x=>x==='yui').length!==1||ids.filter(x=>x==='kaho').length!==1||ids.filter(x=>x==='haruka').length!==1)throw Error('個別回数と一致しません');
 return days;
}
