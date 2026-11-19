// No network or Firebase connection: verify that staging builds fail closed.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertStagingFirebaseConfig,parseAndCheckStagingFirebaseConfig} from './staging-config-guard.mjs';
import {stageHtml,isSafeImportPath} from './build-staging-site.mjs';
const config={apiKey:'fake-key-for-build-test',projectId:'basket-staging-qa',
  authDomain:'basket-staging-qa.firebaseapp.com',appId:'1:123:web:qa'};
assert.equal(assertStagingFirebaseConfig(config),'basket-staging-qa');
assert.equal(parseAndCheckStagingFirebaseConfig(JSON.stringify(config)).projectId,'basket-staging-qa');
for(const id of [
 'aritama-mini-basket','aritama-mini-basket-staging-prod/../../',
 'aritamamini-basket','some-other-production','unsafe-qa-prod','unsafe-test-extra','unsafe-staging-1',''
]){
 assert.throws(()=>assertStagingFirebaseConfig({...config,projectId:id}));
}
assert.throws(()=>assertStagingFirebaseConfig({...config,authDomain:'aritama-mini-basket.firebaseapp.com'}));
assert.throws(()=>assertStagingFirebaseConfig({...config,storageBucket:'aritama-mini-basket.firebasestorage.app'}));
assert.throws(()=>assertStagingFirebaseConfig({...config,apiKey:null}));
assert.throws(()=>parseAndCheckStagingFirebaseConfig('not-json'));
assert.ok(isSafeImportPath('./core.mjs'));
assert.equal(isSafeImportPath('../firebase-config.mjs'),false);
assert.equal(isSafeImportPath('https://example.com/x.js'),false);
const pages=['parent.html','manage-month-approval.html','manage-january-publish.html','review-january.html','manage-swaps.html',
 'manage-parent-answers.html','manage-duty-ledger.html','manage-deadline.html','manage-answer-monitor.html','admin-qa-health.html'];
for(const name of pages){
 const html=await readFile(new URL('./'+name,import.meta.url),'utf8');
 const compiled=stageHtml(html,name);
 assert.match(compiled,/from '.\/firebase-config-staging\.mjs'/);
 assert.doesNotMatch(compiled,/from '.\/firebase-config\.mjs'/);
 assert.match(compiled,/initializeApp\(\(assertStagingFirebaseConfig\(firebaseConfig\),firebaseConfig\)/);
 assert.match(compiled,/🧪 検証版/);
 const js=compiled.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];assert.ok(js);
 new Function(js.replace(/^import[^\n]*;\s*$/gm,''));
 if(name==='manage-january-publish.html'){
  assert.match(compiled,/2027年1月・公開承認/);
  assert.match(compiled,/reviewJanuaryForPublication/);
  assert.match(compiled,/runTransaction/);
 }
 if(name==='parent.html'){
  // Prevent the answer mode controls from slipping below the long calendar on mobile.
  const nameHeading=compiled.indexOf('① お子さんの名前を選ぶ');
  const monthHeading=compiled.indexOf('② 月を選ぶ');
  const modeHeading=compiled.indexOf('③ ×・○の希望入力');
  const calendarHeading=compiled.indexOf('id="calendar-title"');
  assert.ok(nameHeading>=0&&nameHeading<monthHeading&&monthHeading<modeHeading&&modeHeading<calendarHeading);
  assert.doesNotMatch(compiled,/日付ごとの詳しい当番|id="detail"|rowday/,'redundant daily detail list must be absent');
  assert.match(compiled,/id="calendar"/,'calendar is still the single view for duties');
  assert.match(compiled,/class="owner"/,'calendar still displays original duty owners');
  assert.match(compiled,/class="bad"/,'calendar still displays owner × marks');
  assert.match(compiled,/class="good"/,'calendar still displays ○ volunteer marks');
  assert.match(compiled,/class="confirmed"/,'confirmed substitute is still visible in calendar');
  assert.match(compiled,/const tap=answerTapDecision\(\{day:d,existing,kind:selectedMode/,'calendar always uses shared cancel-aware tap logic');
  assert.match(compiled,/const eligible=tap\.enabled/,'calendar button does not use its own stale eligibility');
  assert.match(compiled,/cancel-hint/,'own saved answer shows explicit second-tap cancel hint');
  assert.match(compiled,/action==='different-device'/,'other-device registration must show an alert');
  assert.match(compiled,/committedAction==='delete'/,'cancel success status differs from registration');
  assert.doesNotMatch(compiled,/\(!existing\|\|existing\.updatedBy===auth\.currentUser\?\.uid\)/,
    'a different anonymous UID must not silently disable the entire calendar day');
  assert.match(compiled,/<button id="mark-x"[^>]*>❌ 当番ができない日<[/]button>/);
  assert.match(compiled,/<button id="mark-o"[^>]*>⭕ 代わりにできる日<[/]button>/);
  assert.equal((compiled.match(/id="mark-x"/g)||[]).length,1);
  assert.equal((compiled.match(/id="mark-o"/g)||[]).length,1);
  assert.match(compiled,/from '.\/parent-write-config-staging\.mjs\?v=1'/);
  assert.doesNotMatch(compiled,/from '.\/parent-write-config\.mjs\?v=1'/);
 }
}
console.log('PASS staging fail-closed project guard, all 10 isolated pages, script parsing and accountless parent imports');
