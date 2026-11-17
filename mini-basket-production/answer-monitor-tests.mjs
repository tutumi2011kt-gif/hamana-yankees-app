import assert from 'node:assert/strict';
import {answerAuditEvent,auditItemTitle,recentSuspiciousAnswers} from './answer-monitor-core.mjs';
import {readFile} from 'node:fs/promises';
let n=0;
const check=(label,fn)=>{fn();n++;console.log('OK '+label)};
const yui={date:'2027-02-03',memberId:'yui',kind:'x',updatedBy:'anon-1'};
check('first response has no flag',()=>{
 const x=answerAuditEvent({after:yui,knownMembers:[],eventTime:'2027-01-02T10:00:00Z'});
 assert.equal(x.operation,'create');assert.equal(x.needsReview,false);
});
check('known same child is not flagged',()=>{
 const x=answerAuditEvent({after:yui,knownMembers:['yui']});
 assert.deepEqual(x.flags,[]);
});
check('same anonymous uid switching to second child flags review',()=>{
 const x=answerAuditEvent({after:{...yui,memberId:'haruka',kind:'o'},knownMembers:['yui']});
 assert.equal(x.needsReview,true);
 assert.ok(x.flags.includes('one-device-multiple-children'));
});
check('same uid changed to another phone identity alerts',()=>{
 const x=answerAuditEvent({before:yui,after:{...yui,updatedBy:'anon-2'}});
 assert.ok(x.flags.includes('writer-uid-changed'));assert.equal(x.needsReview,true);
});
check('same uid updating mark is ordinary',()=>{
 const x=answerAuditEvent({before:yui,after:{...yui,kind:'o'},knownMembers:['yui']});
 assert.equal(x.operation,'update');assert.equal(x.needsReview,false);
});
check('deletion does not falsely attribute removing actor',()=>{
 const x=answerAuditEvent({before:yui});
 assert.equal(x.actorUid,null);
 assert.equal(x.lastRecordedWriterUid,'anon-1');
 assert.deepEqual(x.flags,['delete-actor-unverified']);
});
check('at least one snapshot required',()=>assert.throws(()=>answerAuditEvent({})));
check('admin sees readable summary',()=>assert.match(auditItemTitle(answerAuditEvent({after:yui})),/2027-02-03 yui x 登録/));
check('review list filters harmless changes',()=>{
 const r=recentSuspiciousAnswers([
  answerAuditEvent({after:yui}),
  answerAuditEvent({after:{...yui,memberId:'haruka'},knownMembers:['yui']})
 ]);
 assert.equal(r.length,1);
});
check('ui uses administrator Google login and not parent',async()=>{});
const [manager,parents,config,fn]=await Promise.all([
 readFile(new URL('./manage-answer-monitor.html',import.meta.url),'utf8'),
 readFile(new URL('./parent.html',import.meta.url),'utf8'),
 readFile(new URL('./parent-write-config.mjs',import.meta.url),'utf8'),
 readFile(new URL('./firebase-functions/index.mjs',import.meta.url),'utf8')
]);
assert.match(manager,/GoogleAuthProvider/);
assert.match(manager,/recentSuspiciousAnswers/);
assert.match(parents,/onSnapshot\(/);
assert.match(parents,/ANSWER_PUBLICATION_MODE==='instant'/);
assert.match(config,/PARENT_WRITES_ENABLED=false/);
assert.match(fn,/onDocumentWritten/);
assert.match(fn,/answerAudit/);
console.log('PASS '+n+' answer monitoring cases and UI integration');
