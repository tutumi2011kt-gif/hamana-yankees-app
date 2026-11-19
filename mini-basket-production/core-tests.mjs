// Run in a JS environment: node mini-basket-production/core-tests.mjs
import {ROSTER,monthPlus,rollingWindow,inputPermission,practices,buildDraft,auditSchedule,swapStatus,check7DayAlert} from './core.mjs';
function assert(condition,label){if(!condition)throw new Error('FAILED: '+label);console.log('OK '+label)}
// Explicit partial-confirmation fixture; live weekday profiles are tested separately.
const members=ROSTER.map(m=>({...m,days:m.id==='yui'?[3]:m.id==='haruka'?[0,3,5,6]:null,preferredWeekdays:[],approvedWeekendDates:[]}));
assert(monthPlus('2026-12',3)==='2027-03','year crossing');
assert(rollingWindow('2026-12-01').lockThrough==='2027-01','Jan locked Dec1');
assert(rollingWindow('2026-12-01').createMonth==='2027-03','Mar auto-create Dec1');
assert(inputPermission('2027-01','2026-12-01')==='locked','Jan read-only');
assert(inputPermission('2027-02','2026-12-01')==='editable','Feb editable');
assert(inputPermission('2027-03','2026-12-01','awaiting-manager')==='awaiting-manager','Mar requires approval');
const dec=buildDraft({month:'2026-12',members});
assert(!Object.keys(dec.assignments).includes('2026-12-07'),'no duty on Monday');
assert(dec.assignments['2026-12-02']==='yui'||dec.assignments['2026-12-02']==='haruka','Wed eligible');
assert(dec.assignments['2026-12-04']==='haruka','unconfirmed weekdays never assumed');
const prefs={haruka:{unavailable:['2026-12-04']}};
const blocked=buildDraft({month:'2026-12',members,preferences:prefs});
assert(blocked.assignments['2026-12-04']===null,'× never overridden');
assert(!auditSchedule({month:'2026-12',assignments:blocked.assignments,members,preferences:prefs}).ok,'incomplete schedule not approved');
assert(swapStatus({date:'2026-12-02',ownerId:'yui',submissions:{'2026-12-02':{yui:'x'}}}).status==='urgent','zero volunteer urgent');
assert(swapStatus({date:'2026-12-02',ownerId:'yui',submissions:{'2026-12-02':{yui:'x',haruka:'o'}}}).status==='candidate','explicit volunteer candidate, not reassigned');
assert(check7DayAlert({unavailableAt:'2026-11-01T00:00:00Z',volunteers:0,practiseDate:'2026-12-02',now:'2026-11-08T01:00:00Z'}),'7-day alert');
assert(!check7DayAlert({unavailableAt:'2026-11-01T00:00:00Z',volunteers:1,practiseDate:'2026-12-02',now:'2026-11-08T01:00:00Z'}),'candidate stops alert');
