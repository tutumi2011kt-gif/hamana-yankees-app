// Offline release-package validation. This file cannot deploy Firebase or modify production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isValidMonth,allowedAnswerKind,canEditMonth} from './parent-input-core.mjs';
const read=file=>readFile(new URL(file,import.meta.url),'utf8');
const [defaultManifest,candidateManifest,defaultFlag,candidateFlag,parent,rules,qaBuild]=await Promise.all([
 read('./firebase.json'),read('./firebase.parent-writes-candidate.json'),
 read('./parent-write-config.mjs'),read('./parent-write-config.production-candidate.mjs'),
 read('./parent.html'),read('./firestore-parent-anonymous-write-candidate.rules'),
 read('./build-staging-site.mjs')
]);
const main=JSON.parse(defaultManifest),candidate=JSON.parse(candidateManifest);
assert.deepEqual(main.firestore,{rules:'firestore-parent-readonly.rules'},'default rules must remain read-only');
assert.deepEqual(candidate,{firestore:{rules:'firestore-parent-anonymous-write-candidate.rules'}},
 'candidate must contain Firestore rules only, no Hosting, data or Functions');
assert.match(defaultFlag,/PARENT_WRITES_ENABLED=false/);
assert.match(candidateFlag,/PARENT_WRITES_ENABLED=true/);
assert.doesNotMatch(parent,/parent-write-config\.production-candidate\.mjs/,'active parent cannot import candidate');
assert.match(parent,/from '.\/parent-write-config\.mjs\?v=1'/);
assert.match(rules,/DO NOT DEPLOY/,'release must require explicit human review');
for(const term of [/request\.auth\.token\.firebase\.sign_in_provider == 'anonymous'/,
 /request\.time < get\(monthPath\(monthId\)\)\.data\.cutoffAt/,
 /resource\.data\.updatedBy == request\.auth\.uid/,
 /monthId\.matches\('\^2027-/,
 /allow create: if anonymousParent\(\)/,
 /allow update: if anonymousParent\(\)/,
 /allow delete: if anonymousParent\(\)/]){
 assert.match(rules,term,'security rule boundary missing '+term);
}
assert.match(qaBuild,/STAGING_FIREBASE_CONFIG_JSON/);
assert.match(qaBuild,/PARENT_WRITES_ENABLED=true/);
assert.equal(isValidMonth('2027-01'),true);
assert.equal(allowedAnswerKind({kind:'x',ownerId:'yui',memberId:'yui',dayType:'practice'}),true);
assert.equal(allowedAnswerKind({kind:'o',ownerId:'yui',memberId:'haruka',dayType:'practice'}),true);
assert.equal(allowedAnswerKind({kind:'x',ownerId:'yui',memberId:'haruka',dayType:'practice'}),false);
assert.equal(canEditMonth({publication:'draft',inputState:'open'},Date.now()),false);
console.log('PASS opt-in production rules & UI candidates remain isolated; no live writes/deployments performed.');
console.log('PENDING manual gates: Firebase QA real-cloud writes and roles, 19-day January review, approval coverage, rules backup, production release and iPhone verification.');
