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
 'aritamamini-basket','some-other-production',''
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
const pages=['parent.html','manage-month-approval.html','manage-swaps.html',
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
 if(name==='parent.html'){
  assert.match(compiled,/from '.\/parent-write-config-staging\.mjs\?v=1'/);
  assert.doesNotMatch(compiled,/from '.\/parent-write-config\.mjs\?v=1'/);
 }
}
console.log('PASS staging fail-closed project guard, all 8 isolated pages, script parsing and accountless parent imports');
