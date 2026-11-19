// Non-deploying B-plan preflight. Source and Emulator checks cannot prove live Firebase readiness.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [firebase,flag,readonly,candidate,january,correction,swaps,monitor,doc]=await Promise.all([
 read('./firebase.json'),read('./parent-write-config.mjs'),read('./firestore-parent-readonly.rules'),
 read('./firestore-parent-anonymous-write-candidate.rules'),read('./manage-january-publish.html'),
 read('./manage-parent-answers.html'),read('./manage-swaps.html'),read('./manage-answer-monitor.html'),
 read('./B-PLAN-NAME-SELECTION-RELEASE-2026-11.md')
]);
const config=JSON.parse(firebase);
assert.equal(config.firestore.rules,'firestore-parent-readonly.rules','live default must be read-only until signed off');
assert.match(flag,/PARENT_WRITES_ENABLED=false/,'live parent inputs must remain disabled');
assert.match(flag,/ACCOUNT_REQUIRED=false/,'B plan must not add a parent account');
assert.match(readonly,/allow read, write: if isAdmin\(\)/,'only Google administrator may write in the default rule');
assert.doesNotMatch(readonly,/allow\s+(?:create|update|delete)\s*:/,'no parent write grant in default rules');
assert.match(candidate,/DO NOT DEPLOY/,'candidate must be explicitly labelled experimental');
for(const guard of [
 /request\.time\s*>=/,
 /request\.time\s*</,
 /request\.auth\.uid/,
 /resource\.data\.updatedBy\s*==\s*request\.auth\.uid/,
 /get\(dayPath\(/,
 /get\(monthPath\(/,
 /confirmedSubstituteId/,
 /monthId\.matches\('\^2027-/,
 /dayPath\(monthId,/,
 /validAnswerShape/,
 /allow delete: if anonymousParent\(\)/
])assert.match(candidate,guard,'candidate missing a denial boundary: '+guard);
assert.match(january,/2027年1月の既存下書きだけが対象/);
assert.match(january,/reviewJanuaryForPublication/);
assert.match(january,/januaryPublicationPatch/);
assert.match(january,/monthPublicationAudit/);
assert.match(january,/tx\.update\(monthRef/);
assert.match(january,/tx\.update\(rosterRef/);
assert.match(correction,/answerCorrectionAudit/);
assert.match(correction,/管理者権限/);
assert.match(correction,/validateAdminCorrection/);
assert.match(swaps,/GoogleAuthProvider/);
assert.match(swaps,/runTransaction/);
assert.match(swaps,/confirmedSubstituteId/);
assert.match(monitor,/reviewCurrentAnswerState/);
assert.match(monitor,/履歴ではありません/);
assert.match(doc,/名前選択によるなりすましを防止できない/);
assert.match(doc,/会長/);
console.log('PASS B-plan source readiness: no production writes enabled; manager correction, swap and Jan approval guards present.');
console.log('NOT VERIFIED: live production rules/deployment, Cloud Functions audit, QA cloud writes, chair approval and actual iPhone operation.');
