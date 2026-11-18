import assert from 'node:assert/strict';
import {generateAutomaticDraft,historyTotals} from './auto-draft.mjs';
import {ROSTER} from './core.mjs';
import {emptyDraft,normalizeMember} from './month-draft-core.mjs';
import {isDayAllowed} from './weekday-conditions.mjs';
const members=ROSTER.map(normalizeMember),rows=emptyDraft();
rows[0].type='game';rows[1].type='rest';
const input={month:'2027-01',rows,members,calendarConfirmed:true};
const before=JSON.stringify(rows);
const draft=generateAutomaticDraft(input);
assert.equal(JSON.stringify(rows),before);
assert.equal(draft.rows[0].ownerId,null);assert.equal(draft.rows[1].ownerId,null);
for(const r of draft.rows.filter(r=>r.ownerId))assert.ok(isDayAllowed(members.find(m=>m.id===r.ownerId),r.date,r.weekday));
assert.throws(()=>generateAutomaticDraft({...input,calendarConfirmed:false}));
assert.throws(()=>generateAutomaticDraft({...input,month:'2026-12'}));
assert.throws(()=>generateAutomaticDraft({...input,counts:{mia:-1}}));
const noCandidates=generateAutomaticDraft({...input,members:[]});
assert.equal(noCandidates.warnings.length,rows.length-2);
const totals=historyTotals(members,[{date:'2026-12-09',type:'practice',ownerId:'koharu',traineeIds:['sawa'],completed:true},{date:'2026-12-12',ownerId:'an',cancelled:true}],input.month);
assert.equal(totals.counts.koharu,1);assert.equal(totals.counts.sawa,0);assert.equal(totals.carry.an,1);
// January is a partial manual draft: never replace a previously agreed owner.
const january=emptyDraft();
january[0].type='game';january[1].type='rest';
const firstWed=january.find(x=>x.weekday===3);
const secondWed=january.find(x=>x.weekday===3&&x.date!==firstWed.date);
firstWed.ownerId='koharu';
const original=structuredClone(january);
const filled=generateAutomaticDraft({...input,rows:january,preserveExisting:true});
assert.deepEqual(january,original,'preview must not write back to the original January data');
assert.equal(filled.rows.find(x=>x.date===firstWed.date).ownerId,'koharu',
 'preserve the manually saved January owner');
assert.equal(filled.rows.find(x=>x.date===secondWed.date).type,'practice');
assert.equal(filled.allocated.koharu>=1,true,'previously saved owner counts toward fairness');
assert.equal(filled.rows[0].ownerId,null);
assert.equal(filled.rows[1].ownerId,null);
const ordinary=generateAutomaticDraft({...input,rows:january,preserveExisting:false});
assert.notEqual(ordinary.rows.find(x=>x.date===firstWed.date).ownerId,'not-a-person',
 'ordinary future-month recalculation remains independent of pinned January mode');
const existingWrong=january.map(x=>({...x}));
existingWrong.find(x=>x.date===firstWed.date).ownerId='mia';
assert.throws(()=>generateAutomaticDraft({...input,rows:existingWrong,preserveExisting:true}),
 /曜日|担当者|条件/,
 'hard weekday violations must not be silently republished');
const existingUnavailable=january.map(x=>({...x}));
const unavailableMembers=members.map(m=>m.id==='koharu'?{...m,unavailableDates:[firstWed.date]}:m);
assert.throws(()=>generateAutomaticDraft({...input,rows:existingUnavailable,members:unavailableMembers,preserveExisting:true}),
 /既存担当者/,
 'previously pinned duty cannot conflict with a recorded unavailable date');
const noChanges=generateAutomaticDraft({...input,rows:filled.rows,preserveExisting:true});
assert.deepEqual(noChanges.rows,filled.rows,'auto-fill is idempotent if all practice slots have owners');

const equal=members.map(m=>({...m,days:[0,3,5,6],preferredWeekdays:[],start:'2026-01-01'}));
const fair=generateAutomaticDraft({...input,members:equal});
assert.ok(Math.max(...Object.values(fair.allocated))-Math.min(...Object.values(fair.allocated))<=1);
const counts=Object.fromEntries(members.map(m=>[m.id,m.id==='haruka'?100:0]));
assert.equal(generateAutomaticDraft({...input,counts}).allocated.haruka,0);
console.log('PASS automatic draft: hard rules, game/rest, immutable preview, consent, protected December, empty candidates, history/training/carry, fairness, historical counts');
