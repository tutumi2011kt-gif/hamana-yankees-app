(() => {
'use strict';
const ROOT = document.getElementById('app');
const STORAGE_KEY = 'hamana-yankees-gear-check-v2';
const OLD_KEY = 'hamana-yankees-gear-check-v1';
const CACHE_KEY = 'hamana-yankees-gear-master-cache-v1';
const DEFAULT_MODES = [
  {id:'practice',label:'練習試合',icon:'⚾'},
  {id:'official',label:'公式戦',icon:'🏆'},
  {id:'river',label:'河川敷練習',icon:'🌿'}
];
let MODES=DEFAULT_MODES.map(m=>({...m}));
const REPO = 'https://github.com/tutumi2011kt-gif/hamana-yankees-app';
let master=null, view='check', isOffline=false, loadError='';
let firebaseBridge=null, firebaseStatus='connecting', firebaseUser=null, firebaseMessage='';
const cloudStatusLabel=()=>({
  connecting:'接続準備中',ready:'Firebaseから自動更新中',
  empty:'データ未登録（現在はGitHubのリストを表示）',
  locked:'閲覧ルール未設定（現在はGitHubのリストを表示）',
  offline:'Firebaseに接続できません（現在はGitHubのリストを表示）'
})[firebaseStatus]||'確認中';
function receiveCloud(data){
  if(!master||!data||!Array.isArray(data.modes)||!data.modes.length||data.modes.length>40||
     !data.modes.every(m=>m&&/^[a-z0-9_-]{1,50}$/.test(m.id)&&typeof m.label==='string'&&m.label.length<=40)||
     new Set(data.modes.map(m=>m.id)).size!==data.modes.length||
     !verify(master.items,{profiles:data.profiles})){
    firebaseMessage='共有リストの形式が正しくありません。';
    return;
  }
  MODES=data.modes.map(m=>({id:m.id,label:m.label,icon:typeof m.icon==='string'?m.icon.slice(0,4):'⚾'}));
  master.lists={profiles:data.profiles,notes:data.notes||{},revision:data.revision||''};
  saveCache(master);
  if(!MODES.some(m=>m.id===state.mode)){state.mode=MODES[0].id;save()}
  isOffline=false;
  render();
}
async function startFirebase(){
  try {
    const mod=await import('./cloud.js');
    firebaseBridge=mod.connect({
      onData:receiveCloud,
      onStatus:s=>{firebaseStatus=s;render()},
      onUser:u=>{firebaseUser=u;render()}
    });
    render();
  }catch(e){firebaseStatus='offline';render()}
}

let firebaseLoginBusy=false;
function authErrorMessage(error){
  const code=error?.code||'unknown';
  const errors={
    'auth/unauthorized-domain':'このURLがFirebaseの「承認済みドメイン」に登録されていません。Firebase → Authentication → 設定 → 承認済みドメインで「tutumi2011kt-gif.github.io」を追加してください。',
    'auth/popup-blocked':'Googleログインのポップアップがブラウザにブロックされました。アドレスバー右側のポップアップ禁止マークからこのサイトのポップアップを許可してください。',
    'auth/popup-closed-by-user':'Googleログイン画面が閉じられました。もう一度ログインを押してください。',
    'auth/cancelled-popup-request':'ログイン画面が中断されました。少し待ってから、もう一度お試しください。',
    'auth/network-request-failed':'通信エラーが発生しました。インターネット接続を確認してください。',
    'auth/operation-not-supported-in-this-environment':'この起動方法ではGoogleログインできません。ホーム画面のアイコンではなく、Safari・ChromeでアプリのURLを開いてお試しください。',
    'auth/invalid-api-key':'Firebaseの接続設定を確認する必要があります。'
  };
  return (errors[code]||'Googleログインが完了しませんでした。通常のブラウザ（Safari・Chrome）で開き直し、ポップアップを許可してお試しください。')+'（エラー: '+code+'）';
}
function beginFirebaseLogin(){
  if(!firebaseBridge||firebaseLoginBusy)return;
  if(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true){
    firebaseMessage='ホーム画面から起動したアプリではGoogleログイン画面が開かない場合があります。まずSafariまたはChromeで、このアプリのURLを直接開いてログインしてください。';
    render();return;
  }
  firebaseLoginBusy=true;
  firebaseMessage='Googleログイン画面を開いています。ポップアップの別画面を確認してください。表示されない場合は、ブラウザのポップアップ禁止設定をご確認ください。';
  let attempt;
  try{
    // The popup must be requested synchronously from the user's click, BEFORE render().
    attempt=firebaseBridge.login();
  }catch(error){
    firebaseLoginBusy=false;firebaseMessage=authErrorMessage(error);render();return;
  }
  render();
  Promise.resolve(attempt).then(()=>{
    firebaseLoginBusy=false;
    firebaseMessage='Googleログインが完了しました。管理者UIDを確認してください。';
    render();
  },error=>{
    firebaseLoginBusy=false;
    firebaseMessage=authErrorMessage(error);
    render();
  });
}

function safeJSON(text){try{return JSON.parse(text)}catch{return null}}
function readState(){
  const v=safeJSON(localStorage.getItem(STORAGE_KEY) || '');
  const old=v || safeJSON(localStorage.getItem(OLD_KEY) || '') || {};
  const mode=typeof old.mode==='string'&&/^[a-z0-9_-]{1,50}$/.test(old.mode)?old.mode:'river';
  const pref=['auto','summer','winter'].includes(old.seasonPreference)?old.seasonPreference:'auto';
  const checks=old.checks && typeof old.checks==='object' && !Array.isArray(old.checks)?old.checks:{};
  return {mode,seasonPreference:pref,checks};
}
let state;
try { state=readState() } catch { state={mode:'river',seasonPreference:'auto',checks:{}} }
function save(){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)) } catch { /* Private mode may reject writes. */ }
}
function getCache(){
  try{return safeJSON(localStorage.getItem(CACHE_KEY)||'')}catch{return null}
}
function saveCache(data){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch{}
}
function japanDay(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t)?.value || '';
  return {key:get('year')+'-'+get('month')+'-'+get('day'),month:Number(get('month'))};
}
function season(){
  if(state.seasonPreference==='summer'||state.seasonPreference==='winter')return state.seasonPreference;
  const m=japanDay().month;
  return m>=4&&m<=10?'summer':'winter';
}
function profileKey(){return state.mode+'-'+season()}
function checkKey(){return japanDay().key+'|'+profileKey()}
function selected(){const wanted=master.lists.profiles[profileKey()]||[];const set=new Set(wanted);return master.items.items.filter(x=>set.has(x.id))}
function checkedSet(){return new Set(Array.isArray(state.checks[checkKey()])?state.checks[checkKey()]:[])}
function qty(item){return item.seasonQty?.[season()] || item.qty || ''}
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function imageURL(item){
  if(typeof item.image!=='string' || !/^\.\/assets\/items\/[a-z0-9_-]+\.(?:svg|png|webp|jpg)$/.test(item.image))return '';
  return item.image+'?v='+encodeURIComponent(master.items.revision || '1');
}
function verify(items,lists){
  if(!items || !Array.isArray(items.items) || !lists || typeof lists.profiles!=='object' || !lists.profiles)return false;
  if(items.items.length>200 || !items.items.every(x=>typeof x.id==='string'&&/^[a-z0-9_-]+$/.test(x.id)&&typeof x.name==='string'&&[1,2].includes(x.store)))return false;
  const ids=new Set(items.items.map(x=>x.id));
  if(ids.size!==items.items.length)return false;
  return Object.values(lists.profiles).every(v=>Array.isArray(v)&&v.every(id=>ids.has(id)));
}
async function fetchJSON(path){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status+': '+path);
  return response.json();
}
async function loadMaster(){
  try{
    const [items,lists]=await Promise.all([fetchJSON('./data/items.json'),fetchJSON('./data/lists.json')]);
    if(!verify(items,lists))throw Error('マスターデータの形式が正しくありません');
    master={items,lists};saveCache(master);
    isOffline=false;loadError='';
  }catch(e){
    const cached=getCache();
    if(cached&&verify(cached.items,cached.lists)){
      master=cached;isOffline=true;loadError='';
    }else{
      loadError='道具リストを読み込めませんでした。インターネット接続を確認して再試行してください。';
      isOffline=true;
    }
  }
}
function modeTabs(){
  return '<section class="panel"><div class="panel-label">⚾ 今日の活動を選ぶ</div><div class="activity">'+MODES.map(m=>'<button type="button" data-action="mode" data-id="'+m.id+'" class="'+(state.mode===m.id?'active':'')+'" aria-pressed="'+(state.mode===m.id)+'"><span aria-hidden="true">'+m.icon+'</span>'+m.label+'</button>').join('')+'</div></section>';
}
function seasonTabs(){
  const s=season(),auto=state.seasonPreference==='auto';
  return '<section class="panel season-panel"><div><div class="season-copy">☀️ 季節の仕様</div><div class="season-hint">'+(auto?'カレンダーで自動切替':'手動で切替中')+'</div></div><div class="season-options"><button type="button" data-action="season" data-id="summer" class="'+(s==='summer'?'active':'')+'" aria-pressed="'+(s==='summer')+'">☀️ 夏仕様</button><button type="button" data-action="season" data-id="winter" class="'+(s==='winter'?'active':'')+'" aria-pressed="'+(s==='winter')+'">❄️ 冬仕様</button></div><div class="season-extra">4〜10月：夏 / 11〜3月：冬　'+(auto?'自動設定中':'<button type="button" data-action="season" data-id="auto" style="border:0;background:transparent;color:#176b91;font-weight:900;text-decoration:underline;padding:3px">自動設定に戻す</button>')+'</div></section>';
}
function itemHTML(item,checked){
  const on=checked.has(item.id);
  const img=imageURL(item);
  const art=img?'<img loading="lazy" src="'+esc(img)+'" alt="" onerror="this.onerror=null;this.src=\'./assets/items/'+esc(item.id)+'.svg\'" />':'<span aria-hidden="true">📦</span>';
  return '<label class="gear-row '+(on?'done':'')+'" data-row="'+esc(item.id)+'"><input type="checkbox" data-action="check" data-id="'+esc(item.id)+'" '+(on?'checked':'')+' aria-label="'+esc(item.name)+'"><span class="checkmark" aria-hidden="true"></span><span class="gear-image">'+art+'</span><span class="gear-main"><span class="gear-name">'+esc(item.name)+'</span></span>'+(qty(item)?'<span class="gear-qty">'+esc(qty(item))+'</span>':'')+'</label>';
}
function storeHTML(n){
  const list=selected().filter(x=>x.store===n),checked=checkedSet();
  const done=list.filter(x=>checked.has(x.id)).length;
  return '<section class="panel store-card '+(n===2?'store-two':'')+'"><div class="store-head"><div class="store-title"><img class="store-house-art" src="./assets/store/storehouse'+n+'.webp" alt=""><span class="store-label">器具庫 '+n+'</span></div><img class="store-mascot" src="./assets/mascots/'+(n===1?'cheering':'store-cheering')+'.webp" alt=""><span class="store-count" data-count="'+n+'">'+done+' / '+list.length+'</span></div><div class="store-body">'+(list.length?list.map(i=>itemHTML(i,checked)).join(''):'<div class="empty">この器具庫の持ち物はまだ設定されていません。</div>')+'</div></section>';
}
function checklist(){
  const list=selected(),checked=checkedSet(),done=list.filter(x=>checked.has(x.id)).length;
  const note=master.lists.notes?.[profileKey()];
  return (isOffline?'<div class="status warn">現在は保存済みの道具リストを表示しています。通信が戻ったら再読み込みしてください。</div>':'')+
  (note?'<div class="note"><strong>持ち物リストのお知らせ</strong><div>'+esc(note)+'</div></div>':'')+
  storeHTML(1)+storeHTML(2)+
  '<div id="done-message">'+(list.length && done===list.length?'<div class="all-done">🎉 持ち物をすべてチェックしました！</div>':'')+'</div>'+
  '<div class="reset-wrap"><button type="button" class="reset" data-action="reset" '+(!done?'disabled':'')+'>↻ 今日のチェックをリセット</button></div>'+
  '<section class="admin-area"><button type="button" class="admin-open" data-action="admin">⚙ 管理者向け設定 ›</button><div class="admin-help">道具・画像・活動別リストの変更</div></section>';
}
function adminPage(){
  const link=(path,label,alt=false)=>'<a class="admin-link '+(alt?'alt':'')+'" href="'+REPO+'/'+path+'" target="_blank" rel="noopener noreferrer">'+label+'　↗</a>';
  return '<button type="button" class="admin-back" data-action="back">← チェック画面に戻る</button>'+
  '<div class="admin-title">⚙ 管理者向け設定</div>'+
  '<div class="status '+(firebaseStatus==='ready'?'':'warn')+'">☁ '+esc(cloudStatusLabel())+'</div>'+
  '<div class="admin-card"><h3>Firebase・管理者ログイン</h3><p>保護者はログイン不要。管理者だけGoogleでログインします。持ち物の登録には別途Firestoreの権限設定が必要です。</p>'+
  (firebaseMessage?'<p class="status warn" role="status" aria-live="polite">'+esc(firebaseMessage)+'</p>':'')+
  (!firebaseBridge?'<p>Firebaseを準備しています。</p>':!firebaseUser?
   '<button type="button" class="admin-link" data-action="firebase-login" '+(firebaseLoginBusy?'disabled':'')+'>'+(firebaseLoginBusy?'ログイン画面を確認中…':'Googleでログイン')+'</button>':
   '<p>✅ Googleログイン済み</p><p>管理者UID：<code style="overflow-wrap:anywhere">'+esc(firebaseUser.uid)+'</code></p><button type="button" class="admin-small" data-action="firebase-copy">UIDをコピー</button> <button type="button" class="admin-small" data-action="firebase-logout">ログアウト</button>')+
  '<p>Googleのログイン画面は別ウィンドウで開きます。開かない場合は、ブラウザのポップアップ許可設定とFirebaseの承認済みドメインを確認してください。</p>'+
  '<p>現在は接続準備の段階です。セキュリティルールと管理者登録後に、②の画面内編集機能を有効化します。</p></div>'+
  '<p class="admin-notice">道具マスターと画像はGitHubで管理します。編集・保存には、このリポジトリへの書き込み権限があるGitHubアカウントが必要です。閲覧するだけならログイン不要です。</p>'+
  '<section class="admin-section">'+
  '<div class="admin-card"><h3>① 道具の追加・名称・数量を編集</h3><p>道具一覧ファイルの items 配列を変更します。新しい道具には重複しないIDと保管場所を指定してください。</p>'+link('edit/main/gear-check/data/items.json','道具一覧を編集')+'</div>'+
  '<div class="admin-card"><h3>② 活動・季節別のリストを編集</h3><p>各活動に必要な道具IDを設定します。河川敷練習の夏・冬、練習試合、公式戦を個別に管理できます。</p>'+link('edit/main/gear-check/data/lists.json','活動別リストを編集')+'</div>'+
  '<div class="admin-card"><h3>③ 道具のイラストを変更</h3><p>道具ごとに独立した画像ファイルです。GitHubで画像を追加・差し替えし、items.json の image と revision を更新してください。ノックバットは赤色のイラストを登録済みです。</p>'+link('tree/main/gear-check/assets/items','道具イラスト一覧を見る')+'</div>'+
  '<div class="admin-card"><h3>④ 管理手順を見る</h3><p>GitHubでの更新方法、画像のサイズ、変更を全員に反映する手順を説明しています。</p>'+link('blob/main/gear-check/README.md','更新手順を確認',true)+'</div>'+
  '</section>';
}
function render(){
  const modeLabel=MODES.find(x=>x.id===state.mode)?.label||'河川敷練習';
  ROOT.innerHTML='<main class="app"><header class="hero"><img class="hero-art" src="./assets/hero/riverbank.webp" alt="" onerror="this.onerror=null;this.src=\'./assets/hero.svg\'"><div class="hero-shade"></div><div class="brand"><span class="mini-tag">⚾ HAMANA YANKEES</span><h1>浜名ヤンキース<strong>道具チェック</strong></h1><div class="strap">みんなで準備、忘れ物ゼロ！</div></div></header><div class="intro"><i></i><span>今日も元気に、準備スタート！</span></div>'+
  (view==='check' || !master ? modeTabs()+seasonTabs():'')+
  (loadError?'<div class="status warn">'+esc(loadError)+' <button type="button" class="reset" data-action="retry">再読み込み</button></div>':!master?'<div class="status">持ち物リストを準備しています…</div>':view==='check'?checklist():adminPage())+
  '<footer class="footer">浜名ヤンキース｜'+esc(modeLabel)+'<br>道具リストは全員共通・チェックはこの端末だけで保存<br>※公開ページのため、個人情報は登録しないでください。</footer></main>';
}
function updateProgress(){
  const all=selected(),done=checkedSet(),finished=all.filter(x=>done.has(x.id)).length;
  for(const n of [1,2]){const subset=all.filter(x=>x.store===n);const c=ROOT.querySelector('[data-count="'+n+'"]');if(c)c.textContent=subset.filter(x=>done.has(x.id)).length+' / '+subset.length}
  const msg=ROOT.querySelector('#done-message');
  if(msg)msg.innerHTML=all.length&&all.length===finished?'<div class="all-done">🎉 持ち物をすべてチェックしました！</div>':'';
  const reset=ROOT.querySelector('[data-action="reset"]');if(reset)reset.disabled=!finished;
}
ROOT.addEventListener('click',e=>{
  const btn=e.target.closest('button[data-action]');if(!btn)return;
  const a=btn.dataset.action,id=btn.dataset.id;
  if(a==='mode' && MODES.some(m=>m.id===id)){state.mode=id;save();render()}
  else if(a==='season' && ['auto','summer','winter'].includes(id)){state.seasonPreference=id;save();render()}
  else if(a==='admin'){view='admin';render();window.scrollTo({top:0,behavior:'instant'})}
  else if(a==='back'){view='check';render();window.scrollTo({top:0,behavior:'instant'})}
  else if(a==='reset'){if(confirm('この活動の今日のチェックをすべて外しますか？')){state.checks[checkKey()]=[];save();render()}}
  else if(a==='retry'){loadMaster().then(render)}
  else if(a==='firebase-login'){beginFirebaseLogin()}
  else if(a==='firebase-logout'&&firebaseBridge){firebaseBridge.logout().catch(()=>{})}
  else if(a==='firebase-copy'&&firebaseUser){
    navigator.clipboard?.writeText(firebaseUser.uid).then(()=>{firebaseMessage='UIDをコピーしました。';render()})
    .catch(()=>{firebaseMessage='表示されているUIDを選択してコピーしてください。';render()});
  }
});
ROOT.addEventListener('change',e=>{
  const input=e.target;if(input.dataset.action!=='check'||!master)return;
  const id=input.dataset.id;
  if(!selected().some(item=>item.id===id))return;
  const k=checkKey(),prev=checkedSet();
  if(input.checked)prev.add(id);else prev.delete(id);
  state.checks[k]=[...prev];save();
  input.closest('.gear-row')?.classList.toggle('done',input.checked);
  updateProgress();
});
ROOT.addEventListener('error',e=>{
  if(e.target?.tagName!=='IMG'||!e.target.closest('.gear-image'))return;
  const wrap=e.target.closest('.gear-image');wrap.textContent='⚾';wrap.setAttribute('aria-hidden','true');
},true);
async function init(){
  render();
  await loadMaster();
  render();
  startFirebase();
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
  }
}
init();
})();