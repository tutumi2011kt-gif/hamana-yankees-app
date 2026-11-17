// Regression guard: the parent UI must never require a Google account.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const parent=await readFile(new URL('./parent.html',import.meta.url),'utf8');
const admin=await readFile(new URL('./manage-month-approval.html',import.meta.url),'utf8');
const config=JSON.parse(await readFile(new URL('./firebase.json',import.meta.url),'utf8'));
const rules=await readFile(new URL('./firestore-parent-readonly.rules',import.meta.url),'utf8');
assert.match(parent,/signInAnonymously\(auth\)/,'parent silently signs in');
assert.doesNotMatch(parent,/GoogleAuthProvider|signInWithPopup|getIdTokenResult|id="parent-login"|authorizedMembers/,'parent does not require Google login');
assert.match(parent,/id="person"/,'parent can select a child name');
assert.match(parent,/id="mark-x"/,'parent has ×');
assert.match(parent,/id="mark-o"/,'parent has ○');
assert.match(parent,/data-day/,'calendar uses day tap');
assert.match(admin,/GoogleAuthProvider/,'manager still requires Google');
assert.equal(config.firestore.rules,'firestore-parent-readonly.rules','never configure unapproved parent write rules');
assert.doesNotMatch(rules,/allow create|allow update|allow delete/,'parent read-only rule does not grant parent writes');
console.log('PASS 9 accountless parent UI / admin auth / read-only release checks');
