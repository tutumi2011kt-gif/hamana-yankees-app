// Static integration regressions: ensure UI never silently reassigns original owner.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('./'+path,import.meta.url),'utf8');
const [parent,manager,ledger,writeConfig]=await Promise.all([
 read('parent.html'),read('manage-swaps.html'),read('manage-duty-ledger.html'),read('parent-write-config.mjs')
]);
const script=html=>{const m=html.match(/<script type="module">([\s\S]*?)<\/script>/);assert.ok(m,'script exists');new Function(m[1].replace(/^import[^\n]*;\s*$/gm,''));};
script(parent);script(manager);script(ledger);
assert.match(parent,/swapState\(d,marks\)/);
assert.match(parent,/交代候補なし（要調整）/);
assert.match(parent,/管理者確定：/);
assert.match(parent,/parent-write-config\.mjs/);
assert.match(writeConfig,/PARENT_WRITES_ENABLED=false/);
assert.match(parent,/const tap=answerTapDecision\(\{day:d,existing/,'all existing answers use cancellation-aware tap decisions');
assert.match(parent,/!canEditSwapAnswer\(dSnap\.data\(\)\)/,'Firestore transaction still protects manager-confirmed swaps');
assert.match(manager,/validateSwapConfirmation\(/);
assert.match(manager,/validateSwapUndo\(/);
assert.match(manager,/tx\.update\(dRef,\{confirmedSubstituteId:/);
assert.doesNotMatch(manager,/tx\.update\(dRef,\{ownerId/);
assert.match(manager,/tx\.set\(auditRef,/);
assert.match(ledger,/confirmedSubstituteId\|\|day\?\.ownerId/);
assert.match(manager,/元担当者名は固定します/);
console.log('PASS manager / parent / ledger swap UI static integration');
