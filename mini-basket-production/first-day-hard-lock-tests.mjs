// Verify agreed lock: at 00:00 JST on the first of each previous month.
// Never touches live Firebase. Rule literals and admin pages must agree with shared date math.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {jstInputCutoffMillis,jstInputOpenMillis} from './month-rollover-core.mjs';
import {canEditMonth} from './parent-input-core.mjs';
const read=file=>readFile(new URL(file,import.meta.url),'utf8');
const [rules,admin,january,approval,checklist]=await Promise.all([
 read('./firestore-parent-anonymous-write-candidate.rules'),read('./manage-deadline.html'),
 read('./january-publication-core.mjs'),read('./manage-january-publish.html'),
 read('./JANUARY-2027-22-ITEM-REVIEW.md')
]);
const matches=[...rules.matchAll(/monthId == '(2027-\d{2})' && request\.time < timestamp\.value\('([^']+)'\)/g)];
assert.equal(matches.length,11,'enforce all supported January-November 2027 months');
for(let m=1;m<=11;m++){
 const target='2027-'+String(m).padStart(2,'0');
 const cutoff=jstInputCutoffMillis(target),expectUTC=new Date(cutoff).toISOString().replace('.000Z','Z');
 const row=matches.find(match=>match[1]===target);
 assert.ok(row,'missing hard stop for '+target);
 assert.equal(row[2],expectUTC,'wrong timezone or day for '+target);
 const meta={publication:'published',inputState:'open',
  openAt:jstInputOpenMillis(target),cutoffAt:cutoff};
 assert.equal(canEditMonth(meta,cutoff-1),true,'last millisecond should remain eligible for '+target);
 assert.equal(canEditMonth(meta,cutoff),false,'locked exactly at 00:00 JST for '+target);
}
assert.match(rules,/&& beforeFixedMonthLock\(monthId\)/,'hard lock independent of editable cutoffAt');
assert.match(admin,/close!==defaultCutoffMillis\(\$\('month'\)\.value\)/,
 'administrator deadline edit rejects nonstandard close');
assert.match(admin,/id="close"[^>]+readonly/,'deadline is not freely editable');
assert.match(january,/cutoffMillis===jstInputCutoffMillis\(JANUARY_PUBLICATION_MONTH\)/);
assert.match(january,/cutoffMillis!==jstInputCutoffMillis\(JANUARY_PUBLICATION_MONTH\)/);
assert.match(approval,/毎月5日締切は採用しません/);
assert.match(checklist,/正式確定/);
console.log('PASS 11 months hard lock at JST previous month first 00:00, standard metadata, admin editor + January release');
