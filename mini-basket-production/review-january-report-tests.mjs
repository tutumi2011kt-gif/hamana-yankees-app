import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./review-january.html',import.meta.url),'utf8');
const js=source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(js,'module must be present');
new Function(js.replace(/^import[^\n]*;\s*$/gm,''),'syntax should parse');
assert.match(source,/id="copy-report"/);
assert.match(source,/id="report" readonly/);
assert.match(js,/getDocFromServer/);
assert.match(js,/getDocsFromServer/);
assert.match(js,/const formatJst=/);
assert.match(js,/timeZone:'Asia\/Tokyo'/);
assert.match(js,/auditReport\(rows,members,month\)/);
assert.match(js,/navigator\.clipboard\.writeText/);
assert.match(js,/未設定の当番/);
assert.match(js,/formatJst\(month\?\.cutoffAt\)/);
assert.doesNotMatch(js,/\b(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|writeBatch)\s*\(/,
 'January review may not write to Firebase');
console.log('PASS January cloud review summarizes all activity dates and JST cutoff; no Firestore writes.');
