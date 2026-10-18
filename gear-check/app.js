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
const SHARE_URL = 'https://tutumi2011kt-gif.github.io/hamana-yankees-app/gear-check/';
let shareOpen = false, shareMessage = '';
let editor=null, editorBusy=false, editorStatus='';
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
  if(editor&&!editor.newMode&&!MODES.some(m=>m.id===editor.id))chooseEditor(MODES[0].id,editor.season,true);
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
  return '<section class="panel"><div class="panel-label">⚾ 今日の活動を選ぶ</div><div class="activity">'+MODES.map(m=>'<button type="button" data-action="mode" data-id="'+m.id+'" class="'+(state.mode===m.id?'active':'')+'" aria-pressed="'+(state.mode===m.id)+'"><span aria-hidden="true">' +esc(m.icon)+'</span>'+esc(m.label)+'</button>').join('')+'</div></section>';
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

function chooseEditor(id,seasonId,force=false){
  if(!force&&editor?.dirty&&!confirm('未登録の変更があります。破棄して切り替えますか？'))return false;
  const mode=MODES.find(m=>m.id===id);
  if(id!=='__new__'&&!mode)return false;
  editor={id,season:seasonId,newMode:id==='__new__',label:id==='__new__'?'':mode.label,
    selected:new Set(id==='__new__'?[]:master?.lists.profiles[id+'-'+seasonId]||[]),
    note:id==='__new__'?'':String(master?.lists.notes?.[id+'-'+seasonId]||''),
    dirty:false};
  editorStatus='';
  return true;
}
function editorHTML(){
  if(!editor)chooseEditor('river','summer',true);
  const buttons=MODES.map(m=>'<button type="button" class="admin-choice '+(!editor.newMode&&editor.id===m.id?'chosen':'')+
    '" data-action="edit-mode" data-id="'+esc(m.id)+'">'+esc(m.icon)+' '+esc(m.label)+'</button>').join('')+
    '<button type="button" class="admin-choice '+(editor.newMode?'chosen':'')+'" data-action="edit-mode" data-id="__new__">＋ 活動を追加</button>';
  const seasons=['summer','winter'].map(s=>'<button type="button" class="admin-choice '+(editor.season===s?'chosen':'')+
    '" data-action="edit-season" data-id="'+s+'">'+(s==='summer'?'☀️ 夏（4〜10月）':'❄️ 冬（11〜3月）')+'</button>').join('');
  const options=MODES.flatMap(m=>['summer','winter'].map(s=>({id:m.id+'-'+s,title:m.label+'・'+(s==='summer'?'夏':'冬')})))
    .filter(m=>m.id!==editor.id+'-'+editor.season).map(m=>'<option value="'+esc(m.id)+'">'+esc(m.title)+'</option>').join('');
  const gear=n=>'<h4 class="admin-gear-heading">器具庫 '+n+'</h4>'+
    master.items.items.filter(i=>i.store===n).map(i=>
      '<label class="admin-gear"><input type="checkbox" data-action="edit-gear" data-id="'+esc(i.id)+'" '+(editor.selected.has(i.id)?'checked':'')+'>'+
      (imageURL(i)?'<img loading="lazy" alt="" src="'+esc(imageURL(i))+'">':'<span>⚾</span>')+
      '<span>'+esc(i.name)+'</span></label>').join('');
  const enabled=firebaseStatus==='ready'&&firebaseUser&&!editorBusy;
  return '<section class="admin-card admin-editor"><h3>② 活動・季節別のリスト編集</h3>'+
    '<p>活動と季節を選び、必要な道具にチェックを付けて登録すると、保護者の画面にも自動反映されます。</p>'+
    '<div class="admin-grid">'+buttons+'</div><div class="admin-grid">'+seasons+'</div>'+
    '<label class="admin-field">活動名（今日の活動に表示する名前）<input type="text" data-field="edit-title" maxlength="40" value="'+esc(editor.label)+'" placeholder="例：遠征試合"></label>'+
    '<label class="admin-field">ほかの持ち物リストをコピー（任意）<select data-action="edit-copy"><option value="">コピーするリストを選択</option>'+options+'</select></label>'+
    '<div class="admin-countline">必要な道具を選択 <strong id="admin-count">'+editor.selected.size+'点</strong></div>'+
    '<div class="admin-tools"><button type="button" data-action="edit-all">すべて選択</button><button type="button" data-action="edit-clear">すべて解除</button></div>'+
    gear(1)+gear(2)+
    '<label class="admin-field">補足メモ（任意）<textarea rows="2" maxlength="300" data-field="edit-note">'+esc(editor.note)+'</textarea></label>'+
    (editorStatus?'<div class="status '+(editorStatus.startsWith('✅')?'':'warn')+'" role="status">'+esc(editorStatus)+'</div>':'')+
    '<button type="button" class="admin-primary" data-action="edit-save" '+(!enabled?'disabled':'')+'>'+(editorBusy?'保存中…':'登録して全員に反映')+'</button>'+
    (firebaseStatus!=='ready'?'<p class="admin-tip">先にFirebaseの初期登録を済ませてください。</p>':
       !firebaseUser?'<p class="admin-tip">管理者のGoogleログインが必要です。</p>':
       '<p class="admin-tip">登録した内容は、ネット接続中の保護者アプリに自動で反映されます。</p>')+
    '</section>';
}
async function saveEditor(seed=false){
  if(!firebaseBridge||!firebaseUser||editorBusy||!master||firebaseStatus!==(seed?'empty':'ready'))return;
  const modes=MODES.map(m=>({...m}));
  const profiles=Object.fromEntries(Object.entries(master.lists.profiles).map(([key,ids])=>[key,[...ids]]));
  const notes={...(master.lists.notes||{})};
  let newId='',expected=seed?null:master.lists.revision;
  if(!seed){
    const title=editor.label.trim().replace(/\s+/g,' ');
    if(!title||title.length>40){editorStatus='活動名は1〜40文字で入力してください。';render();return}
    if(modes.some(m=>m.label===title&&(editor.newMode||m.id!==editor.id))){
      editorStatus='同じ活動名が既にあります。別の名前にしてください。';render();return;
    }
    if(editor.newMode){
      if(modes.length>=40){editorStatus='活動は40種類まで登録できます。';render();return}
      newId='custom-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      modes.push({id:newId,label:title,icon:'⚾'});
      profiles[newId+'-summer']=[];
      profiles[newId+'-winter']=[];
    }else{
      const active=modes.find(m=>m.id===editor.id);
      if(!active){editorStatus='編集する活動が見つかりません。';render();return}
      active.label=title;
    }
    const profile=(newId||editor.id)+'-'+editor.season;
    profiles[profile]=master.items.items.filter(i=>editor.selected.has(i.id)).map(i=>i.id);
    const note=editor.note.trim();
    if(note&&!(note.includes('未登録')&&profiles[profile].length>0))notes[profile]=note;
    else delete notes[profile];
  }
  editorBusy=true;editorStatus='Firebaseに保存しています…';render();
  try{
    await firebaseBridge.save({modes,profiles,notes,
      revision:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)},expected);
    if(newId){editor.id=newId;editor.newMode=false}
    editor.dirty=false;
    editorStatus=seed?'✅ 初期登録が完了しました。':'✅ 登録完了！保護者の画面に自動反映されます。';
  }catch(e){
    const code=e?.code||'';
    if(code==='permission-denied')editorStatus='保存権限がありません。Firestoreのルールに管理者UIDが正しく設定されているか確認してください。';
    else if(/revision-conflict|already-initialized/.test(e?.message||''))editorStatus='別画面で更新されています。ページを開き直してから再編集してください。';
    else editorStatus='保存できませんでした。通信やFirebase設定を確認してください。'+(code?' ['+code+']':'');
  }finally{editorBusy=false;render()}
}

function adminPage(){
  const link=(path,label,alt=false)=>'<a class="admin-link '+(alt?'alt':'')+'" href="'+REPO+'/'+path+'" target="_blank" rel="noopener noreferrer">'+label+'　↗</a>';
  return '<button type="button" class="admin-back" data-action="back">← チェック画面に戻る</button>'+
  '<div class="admin-title">⚙ 管理者向け設定</div>'+
  '<div class="status '+(firebaseStatus==='ready'?'':'warn')+'">☁ '+esc(cloudStatusLabel())+'</div>'+
  '<div class="admin-card"><h3>管理者のGoogleログイン</h3><p>保護者はログイン不要。活動リストは許可された管理者のみ登録・変更できます。</p>'+
  (firebaseMessage?'<p class="status warn" role="status">'+esc(firebaseMessage)+'</p>':'')+
  (!firebaseBridge?'<p>Firebaseに接続しています…</p>':!firebaseUser?
    '<button type="button" class="admin-link" data-action="firebase-login" '+(firebaseLoginBusy?'disabled':'')+'>'+(firebaseLoginBusy?'ログイン画面を確認中…':'Googleでログイン')+'</button>':
    '<p>✅ Googleログイン済み</p><button type="button" class="admin-small" data-action="firebase-copy">管理者UIDをコピー</button>　<button type="button" class="admin-small" data-action="firebase-logout">ログアウト</button>')+
  '</div>'+
  (firebaseStatus==='empty'?
    '<div class="admin-card"><h3>最初の1回だけ：現在のリストを共有</h3><p>今の河川敷練習・練習試合・公式戦の持ち物をFirebaseにコピーします。道具の画像やチェック状態は変わりません。</p>'+
    '<button type="button" class="admin-primary" data-action="edit-seed" '+(!firebaseUser||editorBusy?'disabled':'')+'>'+(editorBusy?'登録中…':'現在の活動リストをFirebaseに初期登録')+'</button>'+
    (editorStatus?'<p class="admin-tip">'+esc(editorStatus)+'</p>':'')+'</div>':'')+
  editorHTML()+
  '<div class="admin-card"><h3>① 道具の追加・名称・数量を編集</h3><p>道具そのものの登録はGitHubで管理します。</p>'+link('edit/main/gear-check/data/items.json','道具一覧を編集')+'</div>'+
  '<div class="admin-card"><h3>③ 道具のイラストを変更</h3>'+link('tree/main/gear-check/assets/items','道具イラスト一覧を見る')+'</div>'+
  '<div class="admin-card"><h3>④ 管理手順を見る</h3>'+link('blob/main/gear-check/README.md','更新手順を確認',true)+'</div>';
}
function shareHTML(){
  return '<section class="share-section" aria-label="アプリの紹介">'+
    '<button type="button" class="share-main-button" data-action="share-toggle" aria-expanded="'+shareOpen+'" aria-controls="share-qr-panel">'+
      '📱 友だちにアプリを紹介　<span class="share-button-arrow">'+(shareOpen?'▲':'▼')+'</span>'+
    '</button>'+
    (shareOpen?'<div id="share-qr-panel" class="share-panel">'+
      '<p class="share-heading">⚾ 浜名ヤンキース 道具チェック</p>'+
      '<p class="share-instructions">相手のスマホでカメラを向けてね！<br>表示されたリンクをタップするとアプリが開くよ。</p>'+
      '<div class="share-qr-frame"><img src="./assets/share-qr.png" width="280" height="280" alt="浜名ヤンキース道具チェックアプリを開くQRコード"></div>'+
      '<p class="share-url">'+esc(SHARE_URL)+'</p>'+
      '<div class="share-actions">'+
        '<button type="button" class="share-action" data-action="share-copy">🔗 URLをコピー</button>'+
        '<button type="button" class="share-action primary" data-action="share-native">📤 LINEなどで送る</button>'+
      '</div>'+
      (shareMessage?'<p class="share-message" role="status">'+esc(shareMessage)+'</p>':'')+
      '<p class="share-hint">保護者の方はログイン不要。ホーム画面に追加すると次から簡単に開けるよ。</p>'+
    '</div>':'')+
  '</section>';
}
async function copyShareURL(){
  let copied=false;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(SHARE_URL);
      copied=true;
    }
  }catch{}
  if(!copied){
    const box=document.createElement('textarea');
    box.value=SHARE_URL;box.setAttribute('readonly','');
    box.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(box);box.select();
    try{copied=document.execCommand('copy')}catch{}
    box.remove();
  }
  shareMessage=copied?'✅ URLをコピーしたよ！ LINEなどに貼り付けて送ってね。':'コピーできませんでした。上のURLを長押ししてコピーしてね。';
  render();
}
function openNativeShare(){
  if(navigator.share){
    let result;
    try{result=navigator.share({title:'浜名ヤンキース｜道具チェック',text:'少年野球の持ち物チェックアプリだよ！',url:SHARE_URL})}
    catch(e){shareMessage='共有画面を開けませんでした。URLをコピーして送ってね。';render();return}
    Promise.resolve(result).catch(e=>{
      if(e?.name==='AbortError')return;
      shareMessage='共有ができませんでした。URLをコピーして送ってね。';render();
    });
  }else copyShareURL();
}

// Home-screen PWA may resume a previous webview instead of navigating again.
// Refresh from GitHub when returning to the checklist after being in the background.
const FOREGROUND_RELOAD_THRESHOLD_MS=15000;
let hiddenAt=document.hidden?Date.now():0;
let refreshingPage=false;
function reloadLatest(){
  if(refreshingPage)return;
  refreshingPage=true;
  window.location.reload();
}
function refreshOnResume(){
  if(!hiddenAt)return;
  const elapsed=Date.now()-hiddenAt;
  hiddenAt=0;
  // Never interrupt a Firebase admin edit or an active Google-login popup.
  if(elapsed>=FOREGROUND_RELOAD_THRESHOLD_MS&&view==='check'&&!firebaseLoginBusy&&navigator.onLine!==false){
    reloadLatest();
  }
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=Date.now();return}
  refreshOnResume();
});
window.addEventListener('pagehide',()=>{hiddenAt=Date.now()});
window.addEventListener('pageshow',e=>{if(e.persisted)refreshOnResume()});
window.addEventListener('focus',()=>{if(!document.hidden)refreshOnResume()});
function refreshButtonHTML(){
  return '<div class="refresh-panel"><button type="button" class="refresh-button" data-action="reload-latest">'+
    '↻ 最新の持ち物リストに更新</button><span class="refresh-help">ホーム画面から開き直した時も、自動で最新版を確認します</span></div>';
}

function render(){
  const modeLabel=MODES.find(x=>x.id===state.mode)?.label||'河川敷練習';
  ROOT.innerHTML='<main class="app"><header class="hero"><img class="hero-art" src="./assets/hero/riverbank.webp" alt="" onerror="this.onerror=null;this.src=\'./assets/hero.svg\'"><div class="hero-shade"></div><div class="brand"><span class="mini-tag">⚾ HAMANA YANKEES</span><h1>浜名ヤンキース<strong>道具チェック</strong></h1><div class="strap">みんなで準備、忘れ物ゼロ！</div></div></header><div class="intro"><i></i><span>今日も元気に、準備スタート！</span></div>'+
  (view==='check' || !master ? modeTabs()+seasonTabs():'')+
  (view==='check' && master ? refreshButtonHTML():'')+
  (loadError?'<div class="status warn">'+esc(loadError)+' <button type="button" class="reset" data-action="retry">再読み込み</button></div>':!master?'<div class="status">持ち物リストを準備しています…</div>':view==='check'?checklist():adminPage())+
  '<footer class="footer">浜名ヤンキース｜'+esc(modeLabel)+'<br>道具リストは全員共通・チェックはこの端末だけで保存<br>※公開ページのため、個人情報は登録しないでください。</footer>'+shareHTML()+'</main>';
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
  else if(a==='reload-latest'){reloadLatest()}
  else if(a==='share-toggle'){shareOpen=!shareOpen;shareMessage='';render();if(shareOpen)ROOT.querySelector('#share-qr-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
  else if(a==='share-copy'){copyShareURL()}
  else if(a==='share-native'){openNativeShare()}
  else if(a==='edit-mode'&&master&&!editorBusy){if(chooseEditor(id,editor?.season||'summer'))render()}
  else if(a==='edit-season'&&master&&!editorBusy&&['summer','winter'].includes(id)){
    if(editor?.newMode){if(editor.dirty&&!confirm('未保存の内容を破棄して季節を変えますか？'))return;editor.season=id;editor.dirty=false;render()}
    else if(chooseEditor(editor?.id||'river',id))render();
  }
  else if(a==='edit-all'&&editor&&!editorBusy){editor.selected=new Set(master.items.items.map(i=>i.id));editor.dirty=true;render()}
  else if(a==='edit-clear'&&editor&&!editorBusy){editor.selected.clear();editor.dirty=true;render()}
  else if(a==='edit-save'){saveEditor()}
  else if(a==='edit-seed'){saveEditor(true)}
  else if(a==='firebase-login'){beginFirebaseLogin()}
  else if(a==='firebase-logout'&&firebaseBridge){firebaseBridge.logout().catch(()=>{})}
  else if(a==='firebase-copy'&&firebaseUser){
    navigator.clipboard?.writeText(firebaseUser.uid).then(()=>{firebaseMessage='UIDをコピーしました。';render()})
    .catch(()=>{firebaseMessage='表示されているUIDを選択してコピーしてください。';render()});
  }
});
ROOT.addEventListener('change',e=>{
  const input=e.target;
  if(input.dataset.action==='edit-gear'&&editor&&!editorBusy){
    if(input.checked)editor.selected.add(input.dataset.id);else editor.selected.delete(input.dataset.id);
    editor.dirty=true;
    const counter=ROOT.querySelector('#admin-count');if(counter)counter.textContent=editor.selected.size+'点';
    return;
  }
  if(input.dataset.action==='edit-copy'&&editor&&!editorBusy&&input.value){
    const ids=master?.lists.profiles[input.value];
    if(Array.isArray(ids)){
      if(editor.dirty&&!confirm('現在の選択をコピー元で上書きしますか？')){input.value='';return}
      editor.selected=new Set(ids);editor.dirty=true;render();
    }
    return;
  }
  if(input.dataset.action!=='check'||!master)return;
  const id=input.dataset.id;
  if(!selected().some(item=>item.id===id))return;
  const k=checkKey(),prev=checkedSet();
  if(input.checked)prev.add(id);else prev.delete(id);
  state.checks[k]=[...prev];save();
  input.closest('.gear-row')?.classList.toggle('done',input.checked);
  updateProgress();
});
ROOT.addEventListener('input',e=>{
  if(!editor||editorBusy)return;
  if(e.target.dataset.field==='edit-title'){editor.label=e.target.value;editor.dirty=true}
  if(e.target.dataset.field==='edit-note'){editor.note=e.target.value;editor.dirty=true}
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