import assert from 'node:assert/strict';
import {ROSTER} from './core.mjs';
import {buildDutyLedgerRecord,eligibleCarryWindow,ledgerTotals,validLedgerDate,validateLedgerRecords} from './duty-ledger-core.mjs';
const members=ROSTER.map(x=>x.id),today='2027-09-20';
let tests=0;
function check(label,fn){fn();tests++;console.log('OK',label);}
const done=(date,scheduledOwnerId,actualOwnerId,traineeIds=[])=>buildDutyLedgerRecord({date,status:'completed',scheduledOwnerId,actualOwnerId,traineeIds},members,today);
const cancelled=(date,scheduledOwnerId,reason='game',carryState='pending',carryResolvedDate=null)=>buildDutyLedgerRecord({date,status:'cancelled',scheduledOwnerId,reason,carryState,carryResolvedDate},members,today);
check('valid actual date leap/nonleap',()=>{assert.equal(validLedgerDate('2027-02-29'),false);assert.equal(validLedgerDate('2028-02-29'),true)});
check('trainee excluded from actual completed count',()=>{
 const result=ledgerTotals(members,[done('2026-12-09','koharu','koharu',['sawa'])],'2027-04');
 assert.equal(result.counts.koharu,1);assert.equal(result.counts.sawa,0);
});
check('replacement: only actual worker is counted',()=>{
 const totals=ledgerTotals(members,[done('2027-01-03','yui','haruka')],'2027-04');
 assert.equal(totals.counts.yui,0);assert.equal(totals.counts.haruka,1);
});
check('future completed duty cannot be fabricated',()=>assert.throws(()=>buildDutyLedgerRecord({date:'2027-10-01',status:'completed',scheduledOwnerId:'yui',actualOwnerId:'yui'},members,today)));
check('cancelled is not counted as performed',()=>{
 const totals=ledgerTotals(members,[cancelled('2027-01-10','an')],'2027-04');
 assert.equal(totals.counts.an,0);assert.equal(totals.carry.an,1);
});
check('3 to 4 month carry window',()=>assert.deepEqual(eligibleCarryWindow('2027-01-10'),{from:'2027-04',through:'2027-05'}));
check('carry not yet prioritized before 3 months',()=>{
 const totals=ledgerTotals(members,[cancelled('2027-01-10','an')],'2027-03');
 assert.equal(totals.carry.an,0);assert.deepEqual(totals.upcoming,['2027-01-10']);
});
check('eligible carry counts once for fair priority',()=>{
 const totals=ledgerTotals(members,[cancelled('2027-01-10','an')],'2027-05');
 assert.equal(totals.carry.an,1);assert.deepEqual(totals.overdue,[]);
});
check('overdue carry remains visible, never silently forgotten',()=>{
 const totals=ledgerTotals(members,[cancelled('2027-01-10','an')],'2027-06');
 assert.equal(totals.carry.an,1);assert.deepEqual(totals.overdue,['2027-01-10']);
});
check('resolved carry not counted again',()=>{
 const totals=ledgerTotals(members,[cancelled('2027-01-10','an','game','resolved','2027-04-10')],'2027-05');
 assert.equal(totals.carry.an,0);assert.equal(totals.unresolved.length,0);
});
check('no carry option not prioritized',()=>assert.equal(ledgerTotals(members,[cancelled('2027-01-10','an','rest','none')],'2027-06').carry.an,0));
check('counts only previous months, not within draft month',()=>{
 const t=ledgerTotals(members,[done('2027-04-05','koharu','koharu')],'2027-04');
 assert.equal(t.counts.koharu,0);
});
check('duplicate date is blocked',()=>assert.equal(validateLedgerRecords([done('2026-12-09','koharu','koharu'),cancelled('2026-12-09','koharu')],members).ok,false));
check('ineligible owner blocked',()=>assert.throws(()=>done('2026-12-09','not-real','koharu')));
check('non-cancelled carry blocked',()=>assert.throws(()=>buildDutyLedgerRecord({date:'2027-01-10',status:'completed',scheduledOwnerId:'yui',actualOwnerId:'yui',carryState:'pending'},members,today)));
check('invalid resolved date blocked',()=>assert.throws(()=>cancelled('2027-01-10','an','game','resolved','2026-12-20')));
check('history dates are sorted',()=>{
 const t=ledgerTotals(members,[done('2027-03-05','haruka','haruka'),done('2027-02-05','haruka','haruka')],'2027-04');
 assert.deepEqual(t.historyDates.haruka,['2027-02-05','2027-03-05']);
});
console.log('PASS '+tests+' duty ledger tests');
