import assert from 'node:assert/strict';
import {swapState,validateSwapConfirmation,validateSwapUndo,canEditSwapAnswer} from './swap-confirmation-core.mjs';
let count=0;
const check=(label,fn)=>{fn();count++;console.log('OK '+label)};
const day={date:'2027-02-03',type:'practice',ownerId:'yui',confirmedSubstituteId:null};
const marks=[
 {date:day.date,memberId:'yui',kind:'x'},
 {date:day.date,memberId:'haruka',kind:'o'},
 {date:day.date,memberId:'mia',kind:'o'}
];
const members=['yui','haruka','mia'].map(id=>({id,status:'active',startDate:'2026-12-01',endDate:null}));
const argumentsFor={month:'2027-02',publication:'published',day,answers:marks,members,candidateId:'haruka'};
check('owner remains unchanged after confirmation decision',()=>{
 const result=validateSwapConfirmation(argumentsFor);
 assert.deepEqual(result,{originalOwnerId:'yui',confirmedSubstituteId:'haruka'});
 assert.equal(day.ownerId,'yui');
 assert.equal(day.confirmedSubstituteId,null);
});
check('candidate list shows volunteers without auto assigning',()=>{
 const state=swapState(day,marks,members);
 assert.equal(state.status,'candidates');assert.deepEqual(state.candidates,['haruka','mia']);
 assert.equal(state.confirmedId,null);
});
check('zero candidates has urgent status and no automatic assignment',()=>{
 const state=swapState(day,marks.slice(0,1),members);
 assert.equal(state.status,'urgent');assert.equal(state.candidates.length,0);
 assert.throws(()=>validateSwapConfirmation({...argumentsFor,answers:marks.slice(0,1)}),/0人/);
});
check('no owner x blocks confirmation even when o exists',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,answers:marks.slice(1)})));
check('unrecognized candidate blocked',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,candidateId:'koharu'})));
check('wrong owner as candidate blocked',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,candidateId:'yui'})));
check('past December confirmed roster excluded from swap modifications',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,month:'2026-12',day:{...day,date:'2026-12-02'}})));
check('unpublished month cannot confirm',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,publication:'draft'})));
check('game/rest cannot confirm',()=>{
 assert.throws(()=>validateSwapConfirmation({...argumentsFor,day:{...day,type:'game',ownerId:null}}));
 assert.throws(()=>validateSwapConfirmation({...argumentsFor,day:{...day,type:'rest',ownerId:null}}));
});
check('unassigned day cannot confirm',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,day:{...day,ownerId:null}})));
check('different date answer not accepted',()=>assert.throws(()=>validateSwapConfirmation({...argumentsFor,answers:marks.map(a=>({...a,date:'2027-02-10'}))})));
check('inactive candidate rejected',()=>{
 const others=members.map(m=>m.id==='haruka'?{...m,status:'inactive'}:m);
 assert.throws(()=>validateSwapConfirmation({...argumentsFor,members:others}));
});
check('candidate whose joining date is after duty cannot confirm',()=>{
 const others=members.map(m=>m.id==='haruka'?{...m,startDate:'2027-03-01'}:m);
 assert.throws(()=>validateSwapConfirmation({...argumentsFor,members:others}));
});
check('candidate who voluntarily selects Friday is permitted even with weekday preference',()=>{
 const friday={...day,date:'2027-02-05'};
 const fridayMarks=marks.map(a=>({...a,date:friday.date}));
 const result=validateSwapConfirmation({...argumentsFor,day:friday,answers:fridayMarks});
 assert.equal(result.confirmedSubstituteId,'haruka');
});
check('duplicate o entries only one candidate',()=>{
 const m=marks.concat([marks[1]]);
 assert.equal(swapState(day,m,members).candidates.length,2);
});
check('confirmed swap blocked from double confirmation',()=>{
 const confirmed={...day,confirmedSubstituteId:'haruka'};
 assert.equal(swapState(confirmed,marks,members).status,'confirmed');
 assert.equal(canEditSwapAnswer(confirmed),false);
 assert.throws(()=>validateSwapConfirmation({...argumentsFor,day:confirmed}),/交代確定済み/);
});
check('manager can undo only a published confirmed swap',()=>{
 const confirmed={...day,confirmedSubstituteId:'haruka'};
 assert.deepEqual(validateSwapUndo({month:'2027-02',publication:'published',day:confirmed}),{originalOwnerId:'yui',previousSubstituteId:'haruka'});
 assert.throws(()=>validateSwapUndo({month:'2027-02',publication:'draft',day:confirmed}));
 assert.throws(()=>validateSwapUndo({month:'2027-02',publication:'published',day}));
});
check('normal owner no x has normal state, no urgent warning',()=>{
 assert.equal(swapState(day,[]).status,'normal');
 assert.equal(canEditSwapAnswer(day),true);
});
check('confirmed stale marks flag inconsistency',()=>{
 const confirmed={...day,confirmedSubstituteId:'haruka'};
 assert.equal(swapState(confirmed,marks.slice(0,1),members).confirmedStillValid,false);
});
console.log('PASS '+count+' swap confirmation checks');
