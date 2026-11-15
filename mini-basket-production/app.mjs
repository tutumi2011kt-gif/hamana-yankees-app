// Mobile-first UI; local simulation until a separate Firebase project is configured.
// On live Firebase, all assigned days and answers come only from Firestore.
import {ROSTER,DAY_NAMES,todayTokyo,rollingWindow,inputPermission,dayList,practices,buildDraft,auditSchedule,swapStatus} from './core.mjs';
import {cloudConfigured,createCloudClient} from './firebase-client.mjs';

const KEY='basket_prod_preview_v2';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const live=cloudConfigured();
const now=()=>live?todayTokyo():(ui.simulatedDate||todayTokyo());
const windowNow=()=>rollingWindow(now());
let ui={member:'haruka',month:'',mode:'x',simulatedDate:'',marks:{},published:{}};
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object')ui={...ui,...s};}catch(_e){}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(ui));}catch(_e){}};
let cloud=null,cloudMonth=null,cloudRoster=null,cloudMessage={kind:live?'connecting':'unconfigured',detail:live?'接続準備中':'端末内だけの試作です'};
let writing=false;
const roster=()=>live?(cloudRoster||[]):ROSTER;
const name=id=>roster().find(m=>m.id===id)?.name||'未割当';
const publication=month=>ui.published[month]||month!==windowNow().createMonth?'published':'awaiting-manager';
const previewAccess=month=>inputPermission(month,now(),publication(month));
const ms=t=>typeof t?.toMillis==='function'?t.toMillis():typeof t==='number'?t:NaN;
function access(month){
 if(!live)return previewAccess(month);
 if(!cloud || !cloudMonth?.ready || cloudMonth.month!==month)return 'loading';
 const doc=cloudMonth.metadata;
 if(!doc)return 'awaiting-manager';
 if(doc.publication!=='published')return 'awaiting-manager';
 const nowMs=Date.now();
 if(doc.inputState==='open'&&nowMs>=ms(doc.openAt)&&nowMs<ms(doc.cutoffAt))return 'editable';
 return 'locked';
}
function source(month){
 if(!live){
  const draft=buildDraft({month});
  return {ready:true,assignments:draft.assignments,marks:ui.marks[month]||{},
    work:new Set(practices(month).map(d=>d.date)),exceptions:{},members:ROSTER};
 }
 if(!cloudMonth?.ready||cloudMonth.month!==month){
  return {ready:false,assignments:{},marks:{},work:new Set(),exceptions:{},members:roster()};
 }
 const assignments={},marks={},work=new Set(),exceptions={};
 for(const d of cloudMonth.days){
  if(d.type==='practice'){work.add(d.date);assignments[d.date]=d.ownerId||null;}
  else if(d.type==='game'||d.type==='rest')exceptions[d.date]=d.type==='game'?'試合':'休み';
 }
 for(const a of cloudMonth.answers){
  if(!a.date||!a.memberId||!['x','o'].includes(a.kind))continue;
  (marks[a.date]??={})[a.memberId]=a.kind;
 }
 return {ready:true,assignments,marks,work,exceptions,members:roster()};
}
function updateStatus(){
 const el=$('cloud-status');
 if(!el)return;
 if(!live){
  el.textContent='🧪 この端末だけの試作｜Firebase未接続';
  el.style.background='#fff1da';el.style.color='#865721';
 }else{
  const good=cloudMessage.kind==='connected'&&cloudMonth?.ready;
  el.textContent=good?'☁️ 全員と自動共有中':cloudMessage.kind==='error'?'⚠️ Firebase接続エラー：'+cloudMessage.detail:'☁️ '+(cloudMessage.detail||'クラウド読み込み中');
  el.style.background=good?'#e8f8f0':'#fff1da';el.style.color=good?'#176a4e':'#865721';
 }
}
function render(){
 const win=windowNow(),months=[win.lockThrough,...win.inputMonths];
 if(!months.includes(ui.month))ui.month=months[1];
 if(live&&cloud&&(!cloudMonth||cloudMonth.month!==ui.month))cloud.subscribe(ui.month);
 const members=roster().slice().sort((a,b)=>(a.kana||a.name||'').localeCompare(b.kana||b.name||'','ja'));
 $('person').innerHTML=members.length?members.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join(''):'<option value="">メンバーを読み込み中</option>';
 if(members.length&&!members.some(m=>m.id===ui.member))ui.member=members[0].id;
 $('person').value=members.length?ui.member:'';
 $('months').innerHTML=months.map(m=>{
  const permission=m===ui.month?access(m):(previewAccess(m)==='locked'?'locked':'loading');
  const label=permission==='locked'?'🔒変更不可':permission==='editable'?'入力可能':permission==='loading'?'月を選択':'承認待ち';
  return '<button class="month '+(ui.month===m?'chosen':'')+'" data-month="'+m+'">'+Number(m.slice(5))+'月<small>'+label+'</small></button>';
 }).join('');
 const permission=access(ui.month);
 $('status').textContent=permission==='editable'?'✅ この月は×・○を入力できます。':
  permission==='locked'?'🔒 締切済み：閲覧のみ':
  permission==='awaiting-manager'?'⏳ 管理者が承認するまで編集できません。':
  '⌛ 当番表を読み込んでいます。';
 $('mode-x').className='mark '+(ui.mode==='x'?'on-x':'');
 $('mode-o').className='mark '+(ui.mode==='o'?'on-o':'');
 $('month-title').textContent=ui.month.replace('-','年')+'月 当番カレンダー';
 const dayData=dayList(ui.month),data=source(ui.month);
 let html='<div class="week">'+DAY_NAMES.map(d=>'<div>'+d+'</div>').join('')+'</div><div class="cal">';
 for(let i=0;i<dayData[0].weekday;i++)html+='<div class="day empty"></div>';
 for(const d of dayData){
  const assigned=data.assignments[d.date],isWork=data.work.has(d.date),answers=data.marks[d.date]||{};
  const enabled=Boolean(data.ready&&!writing&&permission==='editable'&&assigned&&isWork
    &&(ui.mode==='x'?assigned===ui.member:assigned!==ui.member));
  const swap=swapStatus({date:d.date,ownerId:assigned,submissions:data.marks,members:data.members});
  let content='<span class="num">'+Number(d.date.slice(8))+'</span>';
  if(!data.ready)content+='<span class="extra">読込中</span>';
  else if(!isWork)content+='<span class="extra">当番なし</span>';
  else {
   content+='<span class="owner">'+esc(name(assigned))+'</span>';
   for(const [memberId,kind] of Object.entries(answers))content+='<span class="extra '+(kind==='x'?'bad':'good')+'">'+esc(name(memberId))+' '+(kind==='x'?'×':'○')+'</span>';
   if(swap.status==='urgent')content+='<span class="extra bad">🙏募集中</span>';
  }
  html+='<button class="day '+(enabled?'active ':'')+(enabled&&ui.mode==='o'?'o':'')+'" data-day="'+d.date+'" '+(enabled?'':'disabled')+'>'+content+'</button>';
 }
 $('calendar').innerHTML=html+'</div>';
 if(!data.ready || (live&&!cloudRoster)){
  $('audit').className='status';$('audit').textContent='⌛ クラウドのメンバー・当番表を取得しています';
  $('audit-list').textContent='';$('approve').disabled=true;
 }else{
  const chk=auditSchedule({month:ui.month,assignments:data.assignments,members:data.members,submissions:data.marks,exceptions:data.exceptions});
  $('audit').className=chk.ok?'status':'error';
  $('audit').textContent=chk.ok?'✅ 登録済み条件との重大な衝突なし':
    '⚠️ 要確認 '+chk.blockers.length+'件／曜日未確認 '+chk.warnings.length+'人';
  $('audit-list').innerHTML=[...chk.blockers,...chk.warnings].map(t=>'<p>'+esc(t)+'</p>').join('');
  $('approve').disabled=live||permission!=='awaiting-manager'||!chk.ok;
 }
 $('approve').textContent=live?'本番は管理者専用画面で承認':'管理者が確認して仮公開（試作）';
 $('simulation').disabled=live;
 $('simulation').value=live?'':ui.simulatedDate;
 $('simulation-note').textContent=live?'本番の締切時刻はクラウド側で判定します。':'日付を選んで、月初の表示切替を試せます。';
 updateStatus();
 persist();
}
$('person').addEventListener('change',e=>{ui.member=e.target.value;render()});
$('months').addEventListener('click',e=>{const b=e.target.closest('button[data-month]');if(b){ui.month=b.dataset.month;render()}});
$('mode-x').addEventListener('click',()=>{ui.mode='x';render()});
$('mode-o').addEventListener('click',()=>{ui.mode='o';render()});
$('simulation').addEventListener('change',e=>{if(live)return;ui.simulatedDate=e.target.value;ui.month='';render()});
if(typeof document.addEventListener==='function')document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
$('approve').addEventListener('click',()=>{if(live||access(ui.month)!=='awaiting-manager')return;
 const data=source(ui.month),chk=auditSchedule({month:ui.month,assignments:data.assignments,members:data.members,submissions:data.marks,exceptions:data.exceptions});
 if(!chk.ok){alert('ファクトチェックが未完了のため公開できません。');return;}
 if(confirm('この端末内でのみ仮公開を再現しますか？')){ui.published[ui.month]=true;render();}
});
$('calendar').addEventListener('click',async e=>{
 const b=e.target.closest('button[data-day]');if(!b||b.disabled||writing)return;
 const date=b.dataset.day,month=ui.month,info=source(month),owner=info.assignments[date],mark=ui.mode,memberId=ui.member;
 if(access(month)!=='editable'||!owner||!info.work.has(date)||!(mark==='x'?owner===memberId:owner!==memberId))return;
 const previous=info.marks[date]?.[memberId],symbol=mark==='x'?'×':'○';
 if(!confirm(name(memberId)+'さんとして'+date+'に'+symbol+'を'+(previous===mark?'取り消しますか？':'登録しますか？')))return;
 if(live){
  if(!cloud){alert('Firebaseに接続できていません。保存しません。');return;}
  writing=true;render();
  try{
   await cloud.toggle({month,date,memberId,kind:mark});
   $('status').textContent='✅ クラウドへの保存が完了しました。';
  }catch(err){alert('クラウドへの保存に失敗しました：'+String(err?.code||err?.message||err));}
  finally{writing=false;render();}
 }else{
  ui.marks[month]??={};ui.marks[month][date]??={};
  if(previous===mark)delete ui.marks[month][date][memberId];else ui.marks[month][date][memberId]=mark;
  render();
 }
});
$('cloud-status').textContent='接続状態を確認中';
render();
if(live){
 createCloudClient({
  onStatus:status=>{cloudMessage=status;updateStatus();if(status.kind==='error')render();},
  onRoster:members=>{cloudRoster=members.map(m=>({...m,kana:m.kana||m.reading||m.name,start:m.start||m.startDate||'9999-12-31',end:m.end??m.endDate??null,days:Array.isArray(m.days)?m.days:null}));render();},
  onMonth:data=>{cloudMonth=data;if(data.ready)cloudMessage={kind:'connected',detail:'最新データを受信しました'};render();}
 }).then(c=>{
   cloud=c;
   if(!c){cloudMessage={kind:'error',detail:'Firebaseに接続できませんでした'};render();return;}
   c.subscribe(ui.month);
 });
}
