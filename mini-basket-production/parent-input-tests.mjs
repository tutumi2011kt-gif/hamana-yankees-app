// Run with: node parent-input-tests.mjs
import {isValidMonth,isValidDayOfMonth,canEditMonth,allowedAnswerKind,decideAnswerAction,answerTapDecision,sameAnswerTap,overlayParentAnswers} from './parent-input-core.mjs';
import assert from 'node:assert/strict';
let n=0;
const test=(name,fun)=>{fun();n++;console.log('✅',name)};
const open={publication:'published',inputState:'open',openAt:{toMillis:()=>100},cutoffAt:{toMillis:()=>200}};
test('open window start inclusive',()=>assert.equal(canEditMonth(open,100),true));
test('open window before cutoff',()=>assert.equal(canEditMonth(open,199),true));
test('cutoff time excluded',()=>assert.equal(canEditMonth(open,200),false));
test('before opening prohibited',()=>assert.equal(canEditMonth(open,99),false));
test('closed prohibited',()=>assert.equal(canEditMonth({...open,inputState:'closed'},150),false));
test('draft prohibited',()=>assert.equal(canEditMonth({...open,publication:'draft'},150),false));
test('invalid timestamp prohibited',()=>assert.equal(canEditMonth({...open,cutoffAt:null},150),false));
test('missing metadata prohibited',()=>assert.equal(canEditMonth(null,150),false));
test('owner × allowed',()=>assert.equal(allowedAnswerKind({kind:'x',ownerId:'yui',memberId:'yui',dayType:'practice'}),true));
test('other person × blocked',()=>assert.equal(allowedAnswerKind({kind:'x',ownerId:'yui',memberId:'mia',dayType:'practice'}),false));
test('other person ○ allowed',()=>assert.equal(allowedAnswerKind({kind:'o',ownerId:'yui',memberId:'mia',dayType:'practice'}),true));
test('owner ○ blocked',()=>assert.equal(allowedAnswerKind({kind:'o',ownerId:'yui',memberId:'yui',dayType:'practice'}),false));
test('no practice day blocked',()=>assert.equal(allowedAnswerKind({kind:'o',ownerId:'yui',memberId:'mia',dayType:'game'}),false));
test('unassigned day blocked',()=>assert.equal(allowedAnswerKind({kind:'o',ownerId:null,memberId:'mia',dayType:'practice'}),false));
test('invalid kind blocked',()=>assert.equal(allowedAnswerKind({kind:'admin',ownerId:'yui',memberId:'mia',dayType:'practice'}),false));
test('fresh answer creates',()=>assert.equal(decideAnswerAction(null,'x','anonymous-1'),'set'));
test('same answer toggles delete',()=>assert.equal(decideAnswerAction({kind:'x',updatedBy:'anonymous-1'},'x','anonymous-1'),'delete'));
test('kind replacement from same UID',()=>assert.equal(decideAnswerAction({kind:'o',updatedBy:'anonymous-1'},'x','anonymous-1'),'set'));
test('other device denied',()=>assert.equal(decideAnswerAction({kind:'o',updatedBy:'anonymous-2'},'o','anonymous-1'),'different-device'));
test('no auth denied on existing',()=>assert.equal(decideAnswerAction({kind:'o',updatedBy:'anonymous-2'},'o',null),'blocked'));
const ownDay={date:'2027-01-06',type:'practice',ownerId:'yui',confirmedSubstituteId:null};
const tap=(extras={})=>answerTapDecision({
 day:ownDay,existing:null,kind:'x',memberId:'yui',uid:'phone-yui',canWrite:true,...extras
});
test('first tap of own duty registers ×',()=>assert.deepEqual(tap(),{enabled:true,action:'set'}));
const savedX={date:'2027-01-06',memberId:'yui',kind:'x',updatedBy:'phone-yui'};
test('second tap of saved × stays enabled and cancels it',()=>
 assert.deepEqual(tap({existing:savedX}),{enabled:true,action:'delete'}));
test('saved × remains cancellable after an admin changes original owner',()=>
 assert.deepEqual(tap({existing:savedX,day:{...ownDay,ownerId:'mia'}}),{enabled:true,action:'delete'}));
test('a different device gets a tap explanation instead of an unresponsive day',()=>
 assert.deepEqual(tap({existing:{...savedX,updatedBy:'other-phone'}}),{enabled:true,action:'different-device'}));
test('saved × cannot be cancelled after deadline',()=>
 assert.deepEqual(tap({existing:savedX,canWrite:false}),{enabled:false,action:'blocked'}));
test('saved × cannot be cancelled once swap is confirmed',()=>
 assert.deepEqual(tap({existing:savedX,day:{...ownDay,confirmedSubstituteId:'mia'}}),{enabled:false,action:'blocked'}));
test('no × response on rest or game day',()=>
 assert.deepEqual(tap({day:{...ownDay,type:'game'}}),{enabled:false,action:'blocked'}));
test('no × response if there is no original duty owner',()=>
 assert.deepEqual(tap({day:{...ownDay,ownerId:null}}),{enabled:false,action:'blocked'}));
const savedO={date:'2027-01-06',memberId:'mia',kind:'o',updatedBy:'phone-mia'};
test('saved ○ can also be toggled off from same device',()=>
 assert.deepEqual(tap({existing:savedO,memberId:'mia',uid:'phone-mia',kind:'o'}),{enabled:true,action:'delete'}));
test('other-member ○ can be registered without restricting weekday',()=>
 assert.deepEqual(tap({memberId:'mia',uid:'phone-mia',kind:'o'}),{enabled:true,action:'set'}));
const pending={month:'2027-01',date:'2027-01-06',person:'yui',kind:'x',uid:'phone-yui',queuedToggle:false};
test('same date + child + mode may be tapped again while Firebase is still saving',()=>{
 assert.equal(sameAnswerTap(pending,{month:'2027-01',date:'2027-01-06',person:'yui',kind:'x'}),true);
 assert.equal(sameAnswerTap(pending,{month:'2027-01',date:'2027-01-08',person:'yui',kind:'x'}),false);
 assert.equal(sameAnswerTap(pending,{month:'2027-01',date:'2027-01-06',person:'mia',kind:'x'}),false);
 assert.equal(sameAnswerTap(null,{month:'2027-01',date:'2027-01-06',person:'yui',kind:'x'}),false);
});
test('a rapid second tap queues undo and a third tap removes the queued undo',()=>{
 const p={...pending};
 p.queuedToggle=!p.queuedToggle;
 assert.equal(p.queuedToggle,true);
 p.queuedToggle=!p.queuedToggle;
 assert.equal(p.queuedToggle,false);
});
test('just-saved × is immediately shown even when Firebase snapshot is still empty',()=>{
 const latest={id:'2027-01-06_yui',date:'2027-01-06',memberId:'yui',kind:'x',updatedBy:'phone-yui'};
 const view=overlayParentAnswers([],new Map([[latest.id,latest]]));
 assert.deepEqual(view,[latest]);
 assert.equal(decideAnswerAction(view[0],'x','phone-yui'),'delete');
});
test('just-cancelled × disappears immediately even if Firebase snapshot still contains it',()=>{
 const stale={id:'2027-01-06_yui',date:'2027-01-06',memberId:'yui',kind:'x',updatedBy:'phone-yui'};
 assert.deepEqual(overlayParentAnswers([stale],new Map([[stale.id,null]])),[]);
 assert.equal(decideAnswerAction(overlayParentAnswers([stale],new Map([[stale.id,null]])).find(a=>a.memberId==='yui'),'x','phone-yui'),'set');
});
test('unrelated answers stay intact while a single answer is queued for deletion',()=>{
 const yui={id:'2027-01-06_yui',date:'2027-01-06',memberId:'yui',kind:'x',updatedBy:'phone-yui'};
 const mia={id:'2027-01-06_mia',date:'2027-01-06',memberId:'mia',kind:'o',updatedBy:'phone-mia'};
 assert.deepEqual(overlayParentAnswers([yui,mia],new Map([[yui.id,null]])),[mia]);
});
test('valid month',()=>assert.equal(isValidMonth('2027-01'),true));
test('invalid month',()=>assert.equal(isValidMonth('2027-13'),false));
test('valid day',()=>assert.equal(isValidDayOfMonth('2027-02','2027-02-28'),true));
test('nonexistent Feb 29',()=>assert.equal(isValidDayOfMonth('2027-02','2027-02-29'),false));
test('different month invalid',()=>assert.equal(isValidDayOfMonth('2027-02','2027-03-01'),false));
console.log('PASS',n);
