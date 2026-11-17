import assert from 'node:assert/strict';
import {makeQaFixture} from './staging-fixture-core.mjs';
import {checkQaReadiness,qaReadinessReport} from './qa-readiness-core.mjs';
import {parseQaVerifyArgs} from './firebase-functions/verify-qa.mjs';
const projectId='basket-staging-qa',fixture=makeQaFixture(projectId);
const jsonEntries=fixture.entries;
const get=x=>jsonEntries.find(row=>row.path===x)?.data;
const team='teams/'+fixture.teamId;
const month={};
for(const m of [fixture.publishedMonth,fixture.draftMonth]){
 const {openAtMillis,cutoffAtMillis,...data}=get(team+'/months/'+m);
 month[m]={...data,openAt:{toMillis:()=>openAtMillis},cutoffAt:{toMillis:()=>cutoffAtMillis}};
}
const snapshot={
 marker:{qaOnly:true,projectId,version:1},
 admin:{enabled:true,qaOnly:true},
 roster:get(team+'/public/roster'),
 months:month,
 members:fixture.members,
 days:{
  [fixture.publishedMonth]:fixture.janDays,
  [fixture.draftMonth]:fixture.marchDays
 },
 unexpectedMonthIds:[]
};
const now=Date.parse('2026-11-17T19:00:00+09:00');
const check=(s=snapshot)=>checkQaReadiness({projectId,snapshot:s,nowMillis:now});
let tests=0;function test(name,fn){fn();tests++;console.log('OK '+name);}
test('fresh staging fixture is ready',()=>{
 const result=check();
 assert.equal(result.pass,true,qaReadinessReport(result));
 assert.deepEqual(result.blockers,[]);
 assert.match(qaReadinessReport(result),/準備OK/);
});
test('production project is never accepted',()=>assert.throws(()=>checkQaReadiness({projectId:'aritama-mini-basket',snapshot})));
test('marker wrong project blocks staging',()=>{
 const x=check({...snapshot,marker:{...snapshot.marker,projectId:'some-other-qa'}});
 assert.ok(x.blockers.includes('marker'));
});
test('admin must be QA enabled',()=>{
 const x=check({...snapshot,admin:{enabled:false,qaOnly:true}});
 assert.ok(x.blockers.includes('admin'));
});
test('real names are never permitted',()=>{
 const x=check({...snapshot,members:[{...snapshot.members[0],name:'実在の名前'},...snapshot.members.slice(1)]});
 assert.ok(x.blockers.includes('members'));
});
test('published months cannot include unapproved March',()=>{
 const x=check({...snapshot,roster:{...snapshot.roster,publishedMonths:['2027-01','2027-03']}});
 assert.ok(x.blockers.includes('publishedMonths'));
});
test('open January requires a valid time window',()=>{
 const x=checkQaReadiness({projectId,snapshot,nowMillis:Date.parse('2026-12-01T00:00:00+09:00')});
 assert.ok(x.blockers.includes('inputWindow'));
});
test('March cannot be prematurely published',()=>{
 const x=check({...snapshot,months:{...snapshot.months,'2027-03':{...snapshot.months['2027-03'],publication:'published'}}});
 assert.ok(x.blockers.includes('march'));
});
test('a practice day requires exactly one assigned QA owner',()=>{
 const d=[{...snapshot.days['2027-01'][0],ownerId:null},...snapshot.days['2027-01'].slice(1)];
 const x=check({...snapshot,days:{...snapshot.days,'2027-01':d}});
 assert.ok(x.blockers.includes('januaryDays'));
});
test('March must have no provisional assignees',()=>{
 const d=[{...snapshot.days['2027-03'][0],ownerId:'qa01'},...snapshot.days['2027-03'].slice(1)];
 const x=check({...snapshot,days:{...snapshot.days,'2027-03':d}});
 assert.ok(x.blockers.includes('marchDays'));
});
test('unexpected extra months are warnings, not silent',()=>{
 const x=check({...snapshot,unexpectedMonthIds:['2027-02']});
 assert.equal(x.pass,true);
 assert.ok(x.warnings.includes('unexpectedMonths'));
});
test('offline CLI does not require a Firebase UID',()=>{
 const x=parseQaVerifyArgs(['--project',projectId]);
 assert.equal(x.remote,false);
});
test('remote CLI demands two matching QA IDs and admin UID',()=>{
 assert.throws(()=>parseQaVerifyArgs(['--project',projectId,'--remote']));
 assert.throws(()=>parseQaVerifyArgs(['--project',projectId,'--confirm','other-test','--admin-uid','test-admin-01','--remote']));
 assert.throws(()=>parseQaVerifyArgs(['--project','aritama-mini-basket','--remote']));
 const x=parseQaVerifyArgs(['--project',projectId,'--confirm',projectId,'--admin-uid','test-admin-01','--remote']);
 assert.equal(x.remote,true);
});
console.log('PASS '+tests+' staging readiness validator cases');
