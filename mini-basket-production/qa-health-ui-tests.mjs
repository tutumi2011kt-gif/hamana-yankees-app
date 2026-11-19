import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const ui=await readFile(new URL('./admin-qa-health.html',import.meta.url),'utf8');
const cli=await readFile(new URL('./firebase-functions/verify-qa.mjs',import.meta.url),'utf8');
const builder=await readFile(new URL('./build-staging-site.mjs',import.meta.url),'utf8');
assert.match(ui,/GoogleAuthProvider/,'only QA manager authenticates');
assert.match(ui,/admin\.data\(\)\.qaOnly!==true/,'QA-only admin check');
assert.match(ui,/checkQaReadiness/,'uses same readiness guard as CLI');
assert.match(ui,/from '.\/firebase-config\.mjs'/,'staging builder must rewrite config import');
assert.match(ui,/initializeApp\(firebaseConfig/,'staging builder must insert project guard');
assert.doesNotMatch(ui,/\b(setDoc|updateDoc|deleteDoc|runTransaction|addDoc|writeBatch)\s*\(/,
  'QA health page cannot mutate Firebase');
assert.doesNotMatch(cli,/\b(setDoc|updateDoc|deleteDoc|runTransaction|addDoc|writeBatch)\s*\(/,
  'QA health CLI cannot mutate Firebase');
assert.match(builder,/'admin-qa-health\.html':'admin-qa-health\.html'/);
const js=ui.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);new Function(js.replace(/^import[^\n]*;\s*$/gm,''));
console.log('PASS admin QA readiness UI is Google-only, staging guarded, and read-only');
