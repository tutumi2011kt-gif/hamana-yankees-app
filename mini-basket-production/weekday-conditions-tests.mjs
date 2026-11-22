// Run from this directory with Node: node weekday-conditions-tests.mjs
import assert from 'node:assert/strict';
import {WEEKDAY_UPDATES,PROFILE_IDS,isDayAllowed,weekdayOf,isPreferredWeekday} from './weekday-conditions.mjs';
import {ROSTER,buildDraft} from './core.mjs';
import {normalizeMember,emptyDraft,auditDraft} from './month-draft-core.mjs';
let n=0;
function test(label,work){work();n++;console.log('✅ '+label)}
const byId=Object.fromEntries(ROSTER.map(x=>[x.id,x]));
const dates={wed:'2027-01-06',fri:'2027-01-08',sat:'2027-01-09',sun:'2027-01-10'};
const w={wed:3,fri:5,sat:6,sun:0};
test('12 confirmed profiles',()=>assert.equal(PROFILE_IDS.length,12));
test('Sawa Friday prohibition included',()=>assert.deepEqual(WEEKDAY_UPDATES.sawa.days,[0,3,6]));
for(const [id,allowed] of [
 ['wakana',['wed','fri','sat','sun']],
 ['mia',['sat']],['yui',['wed']],['an',['sat','sun']],
 ['mai',['wed','fri','sat','sun']],['koharu',['wed']],
 ['nagisa',['wed','fri']],['nodoka',['wed','fri','sun']],
 ['sayaka',['wed','fri','sat','sun']],['haruka',['wed','fri','sat','sun']],
 ['kaho',['wed','fri']],['sawa',['wed','sat','sun']]
 ]){
 test(id+' absolute/regular allowed weekdays',()=>{
  for(const [key,date] of Object.entries(dates)){
   assert.equal(isDayAllowed(byId[id],date,w[key]),allowed.includes(key),id+' '+key);
  }
 });
}
test('Sawa can begin Jan 2027 but cannot do Friday',()=>{
 assert.equal(isDayAllowed(byId.sawa,'2026-12-30',3),false);
 assert.equal(isDayAllowed(byId.sawa,dates.wed,3),true);
 assert.equal(isDayAllowed(byId.sawa,dates.fri,5),false);
 assert.equal(isDayAllowed(byId.sawa,dates.sat,6),true);
 assert.equal(isDayAllowed(byId.sawa,dates.sun,0),true);
});
test('Mai prefers Wednesday but can do weekends',()=>{
 assert.equal(isPreferredWeekday(byId.mai,3),true);
 assert.equal(isPreferredWeekday(byId.mai,6),false);
 assert.equal(isDayAllowed(byId.mai,dates.sat,6),true);
});
test('Nagisa is NOT auto-assigned on weekend',()=>{
 assert.equal(isDayAllowed(byId.nagisa,dates.sat,6),false);
 assert.equal(isDayAllowed(byId.nagisa,dates.sun,0),false);
});
test('Only Nagisa can use advance explicit weekend approval',()=>{
 const approved={...byId.nagisa,approvedWeekendDates:[dates.sat]};
 assert.equal(isDayAllowed(approved,dates.sat,6),true);
 assert.equal(isDayAllowed(approved,dates.sun,0),false);
 assert.equal(isDayAllowed({...byId.yui,approvedWeekendDates:[dates.sat]},dates.sat,6),false);
});
test('Yui becomes eligible for Wednesday and Sunday on 2027-04-01',()=>{
 const yui=byId.yui;
 assert.equal(isDayAllowed(yui,'2027-03-28'),false,'March Sunday must remain prohibited');
 assert.equal(isDayAllowed(yui,'2027-03-31'),true,'March Wednesday allowed');
 assert.equal(isDayAllowed(yui,'2027-04-04'),true,'April Sunday allowed');
 assert.equal(isDayAllowed(yui,'2027-04-07'),true,'April Wednesday allowed');
 assert.equal(isDayAllowed(yui,'2027-04-02'),false,'April Friday prohibited');
 assert.equal(isDayAllowed(yui,'2027-04-03'),false,'April Saturday prohibited');
 assert.equal(isDayAllowed(yui,'2027-11-07'),true,'November Sunday allowed');
 assert.equal(isDayAllowed({...yui,status:'paused'},'2027-04-04'),false,'Inactive Yui prohibited');
 assert.equal(isDayAllowed({...yui,unavailableDates:['2027-04-04']},'2027-04-04'),true,'isDayAllowed handles weekday only; caller checks unavailable dates');
});
test('February non-existent date rejected',()=>assert.equal(weekdayOf('2027-02-29'),null));
test('Missing start date rejected',()=>assert.equal(isDayAllowed({...byId.mia,start:null},dates.sat,6),false));
test('Retired member rejected',()=>assert.equal(isDayAllowed({...byId.mia,status:'retired'},dates.sat,6),false));
test('Jan draft checks Sat-only Mia',()=>{
 const rows=emptyDraft(),day=rows.find(x=>x.date===dates.wed);day.ownerId='mia';
 const audit=auditDraft('2027-01',rows,[normalizeMember(byId.mia)]);
 assert.equal(audit.ok,false);assert.ok(audit.problems.some(x=>x.includes('曜日条件')));
});
test('Jan draft rejects Sawa Friday and accepts Sawa Saturday',()=>{
 const rows=emptyDraft(),fri=rows.find(x=>x.date===dates.fri),sat=rows.find(x=>x.date===dates.sat);
 fri.ownerId='sawa';
 const rejected=auditDraft('2027-01',rows,[normalizeMember(byId.sawa)]);
 assert.equal(rejected.ok,false);
 fri.ownerId=null;sat.ownerId='sawa';
 const accepted=auditDraft('2027-01',rows,[normalizeMember(byId.sawa)]);
 assert.equal(accepted.ok,true);
});
test('Jan draft allows Mai weekend but warns preference',()=>{
 const rows=emptyDraft(),day=rows.find(x=>x.date===dates.sat);day.ownerId='mai';
 const audit=auditDraft('2027-01',rows,[normalizeMember(byId.mai)]);
 assert.equal(audit.ok,true);assert.ok(audit.warnings.some(x=>x.includes('別曜日を希望')));
});
test('Auto draft never assigns anyone on banned weekday',()=>{
 const draft=buildDraft({month:'2027-01',members:ROSTER});
 for(const [date,id] of Object.entries(draft.assignments)){
  if(id)assert.equal(isDayAllowed(byId[id],date),true,date+' '+id);
 }
});
test('Auto draft may assign Sawa only on Wed, Sat, Sun from Jan 2027',()=>{
 const draft=buildDraft({month:'2027-01',members:ROSTER});
 for(const [date,id] of Object.entries(draft.assignments)){
  if(id==='sawa')assert.ok([0,3,6].includes(weekdayOf(date)));
 }
 const dec=buildDraft({month:'2026-12',members:ROSTER});
 assert.ok(Object.values(dec.assignments).every(id=>id!=='sawa'));
});
console.log('PASS '+n+' weekday rule tests');
