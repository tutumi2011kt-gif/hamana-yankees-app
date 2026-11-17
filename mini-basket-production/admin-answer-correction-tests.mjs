import assert from 'node:assert/strict';
import {validateAdminCorrection,signatureAnswer} from './admin-answer-correction-core.mjs';
let cases=0;
const test=(n,fn)=>{fn();cases++;console.log('OK',n)};
const day={date:'2027-02-03',type:'practice',ownerId:'yui',confirmedSubstituteId:null};
const yui={id:'yui',status:'active',startDate:'2026-12-01',endDate:null};
const haruka={id:'haruka',status:'active',startDate:'2026-12-01',endDate:null};
const base={month:'2027-02',publication:'published',day,member:yui,kind:'x',action:'set'};
test('only owner can mark x',()=>assert.equal(validateAdminCorrection(base).memberId,'yui'));
test('volunteer can mark o',()=>assert.equal(validateAdminCorrection({...base,member:haruka,kind:'o'}).memberId,'haruka'));
test('other child cannot mark owner x',()=>assert.throws(()=>validateAdminCorrection({...base,member:haruka})));
test('owner cannot mark o',()=>assert.throws(()=>validateAdminCorrection({...base,kind:'o'})));
test('manager can remove prior existing response',()=>{
 const existing={date:day.date,memberId:'yui',kind:'x',updatedBy:'old-anonymous'};
 assert.deepEqual(validateAdminCorrection({...base,action:'remove',existing}),{action:'remove',date:day.date,memberId:'yui'});
});
test('cannot remove nonexistent response',()=>assert.throws(()=>validateAdminCorrection({...base,action:'remove',existing:null})));
test('invalid member blocked',()=>assert.throws(()=>validateAdminCorrection({...base,member:{...yui,status:'inactive'}})));
test('future joined member blocked',()=>assert.throws(()=>validateAdminCorrection({...base,member:{...yui,startDate:'2027-03-01'}})));
test('game day blocked',()=>assert.throws(()=>validateAdminCorrection({...base,day:{...day,type:'game',ownerId:null}})));
test('confirmed swap blocked',()=>assert.throws(()=>validateAdminCorrection({...base,day:{...day,confirmedSubstituteId:'haruka'}})));
test('unpublished month blocked',()=>assert.throws(()=>validateAdminCorrection({...base,publication:'draft'})));
test('protected December cannot be edited',()=>assert.throws(()=>validateAdminCorrection({...base,month:'2026-12',day:{...day,date:'2026-12-02'}})));
test('signature identifies changes across phones',()=>{
 const a={date:day.date,memberId:'yui',kind:'x',updatedBy:'uid1',updatedAt:{toMillis:()=>1234}};
 assert.notEqual(signatureAnswer(a),signatureAnswer({...a,updatedBy:'uid2'}));
 assert.equal(signatureAnswer(null),null);
});
console.log('PASS '+cases+' manager response correction tests');
