// node month-rollover-tests.mjs
import assert from 'node:assert/strict';
import {
 validMonth,addMonths,jstMonthStartMillis,jstInputOpenMillis,jstInputCutoffMillis,
 monthlyRolloverPlan,tokyoCalendarMonth,preliminaryPracticeDays
} from './month-rollover-core.mjs';
import {defaultCutoffMillis,defaultOpenMillis,canEditMonth} from './parent-input-core.mjs';
let n=0;
const check=(label,f)=>{f();n++;console.log('OK '+label)};
const instant=s=>Date.parse(s);
check('month formats',()=>{assert.ok(validMonth('2027-03'));assert.equal(validMonth('2027-13'),false)});
check('cross-year month addition',()=>{assert.equal(addMonths('2026-12',3),'2027-03');assert.equal(addMonths('2027-01',-1),'2026-12')});
check('Dec 1 locks Jan and creates Mar',()=>assert.deepEqual(monthlyRolloverPlan('2026-12'),{
 startOfMonthMillis:instant('2026-12-01T00:00:00+09:00'),
 lockMonth:'2027-01',createMonth:'2027-03',inputMonths:['2027-02','2027-03']
}));
check('Jan 1 locks Feb and creates Apr',()=>{const p=monthlyRolloverPlan('2027-01');assert.equal(p.lockMonth,'2027-02');assert.equal(p.createMonth,'2027-04')});
check('Feb 1 locks Mar and creates May',()=>{const p=monthlyRolloverPlan('2027-02');assert.equal(p.lockMonth,'2027-03');assert.equal(p.createMonth,'2027-05')});
check('January cutoff exactly Dec 1 JST midnight',()=>assert.equal(jstInputCutoffMillis('2027-01'),instant('2026-12-01T00:00:00+09:00')));
check('March opening exactly Dec 1 JST midnight',()=>assert.equal(jstInputOpenMillis('2027-03'),instant('2026-12-01T00:00:00+09:00')));
check('March cutoff exactly Feb 1 JST midnight',()=>assert.equal(jstInputCutoffMillis('2027-03'),instant('2027-02-01T00:00:00+09:00')));
check('same defaults used by deadline UI',()=>{assert.equal(defaultCutoffMillis('2027-01'),jstInputCutoffMillis('2027-01'));assert.equal(defaultOpenMillis('2027-03'),jstInputOpenMillis('2027-03'))});
check('last millisecond of Nov still permits January input',()=>{
 const meta={publication:'published',inputState:'open',openAt:jstInputOpenMillis('2027-01'),cutoffAt:jstInputCutoffMillis('2027-01')};
 assert.equal(canEditMonth(meta,instant('2026-11-30T23:59:59.999+09:00')),true);
 assert.equal(canEditMonth(meta,instant('2026-12-01T00:00:00.000+09:00')),false);
});
check('JST calendar rollover at Tokyo midnight independent of UTC month',()=>{
 assert.equal(tokyoCalendarMonth(new Date('2026-11-30T14:59:59.999Z')),'2026-11');
 assert.equal(tokyoCalendarMonth(new Date('2026-11-30T15:00:00Z')),'2026-12');
});
check('March draft contains only Wed Fri Sat Sun and no invented owners',()=>{
 const days=preliminaryPracticeDays('2027-03');
 assert.equal(days.length,17);
 assert.ok(days.every(d=>[0,3,5,6].includes(d.weekday)));
 assert.ok(days.every(d=>d.ownerId===null&&d.type==='practice'));
});
check('invalid input rejected',()=>{
 assert.throws(()=>jstInputCutoffMillis('2027-00'));
 assert.throws(()=>monthlyRolloverPlan('2026-13'));
});
console.log('PASS '+n+' month rollover and Japanese midnight tests');
