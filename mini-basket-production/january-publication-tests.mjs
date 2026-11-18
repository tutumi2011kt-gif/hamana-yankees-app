import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROSTER} from './core.mjs';
import {normalizeMember,calendarDates} from './month-draft-core.mjs';
import {jstInputOpenMillis,jstInputCutoffMillis} from './month-rollover-core.mjs';
import {reviewJanuaryForPublication,januaryPublicationPatch,januaryDaySignature,
 JANUARY_PUBLICATION_MONTH} from './january-publication-core.mjs';

const month=JANUARY_PUBLICATION_MONTH,now=Date.parse('2026-11-18T19:00:00+09:00');
const members=ROSTER.map(normalizeMember),roster={members:members.map(({id,name,kana})=>({id,name,kana})),publishedMonths:['2026-12']};
const meta={publication:'draft',inputState:'closed',version:2};
const openMillis=jstInputOpenMillis(month),cutoffMillis=jstInputCutoffMillis(month);
const days=()=>calendarDates(month).map(d=>({...d,type:'practice',
 ownerId:d.weekday===3?'yui':d.weekday===5?'kaho':d.weekday===6?'mia':'an',eventLocation:'',traineeIds:[]}));
const evaluate=(overrides={})=>reviewJanuaryForPublication({
 month,meta,days:days(),members,roster,openMillis,cutoffMillis,nowMillis:now,...overrides
});
let n=0;
function check(name,fn){fn();n++;console.log('OK '+name)}
check('January manual draft can be fully approved with 19 checked days',()=>{
 const x=evaluate();assert.equal(x.ok,true,JSON.stringify(x.errors));
 assert.equal(x.days,19);assert.equal(x.practice,19);
});
check('December confirmed month cannot be published from January screen',()=>{
 assert.equal(evaluate({month:'2026-12'}).ok,false);
});
check('March auto-generated month cannot be published from January screen',()=>{
 assert.equal(evaluate({month:'2027-03'}).ok,false);
});
check('already published January is rejected',()=>{
 assert.equal(evaluate({meta:{...meta,publication:'published'}}).ok,false);
});
check('January draft with input already open is rejected',()=>{
 assert.equal(evaluate({meta:{...meta,inputState:'open'}}).ok,false);
});
check('January with missing version is rejected',()=>{
 assert.equal(evaluate({meta:{...meta,version:undefined}}).ok,false);
});
check('January with unfinished practice assignment is rejected',()=>{
 const x=days();x[0].ownerId=null;
 assert.equal(evaluate({days:x}).ok,false);
});
check('unapproved weekday is rejected, including Sawa on Friday',()=>{
 const x=days();x.find(d=>d.weekday===5).ownerId='sawa';
 assert.equal(evaluate({days:x}).ok,false);
});
check('game day and rest day can be approved without an assignee',()=>{
 const x=days();x[0].type='game';x[0].ownerId=null;x[1].type='rest';x[1].ownerId=null;
 assert.equal(evaluate({days:x}).ok,true);
});
check('game day assigned owner is rejected',()=>{
 const x=days();x[0].type='game';
 assert.equal(evaluate({days:x}).ok,false);
});
check('missing or duplicate days are rejected',()=>{
 const x=days();x.pop();assert.equal(evaluate({days:x}).ok,false);
 x.push({...x[0]});assert.equal(evaluate({days:x}).ok,false);
});
check('public roster must be the same 12 distinct members',()=>{
 assert.equal(evaluate({roster:{members:[],publishedMonths:['2026-12']}}).ok,false);
 assert.equal(evaluate({roster:{...roster,members:[...roster.members.slice(0,11),{...roster.members[0]}]}}).ok,false);
});
check('do not publish January a second time',()=>{
 assert.equal(evaluate({roster:{...roster,publishedMonths:['2026-12','2027-01']}}).ok,false);
});
check('invalid or expired cutoff cannot authorize publication',()=>{
 assert.equal(evaluate({cutoffMillis:openMillis}).ok,false);
 assert.equal(evaluate({cutoffMillis:now-1}).ok,false);
 assert.equal(evaluate({openMillis:NaN}).ok,false);
});
check('patch does not override December or other months and respects closed input period',()=>{
 const copy=structuredClone(meta);
 const patch=januaryPublicationPatch({meta,openMillis,cutoffMillis,nowMillis:now});
 assert.deepEqual(meta,copy);assert.equal(patch.publication,'published');
 assert.equal(patch.inputState,'open');assert.equal(patch.scheduleVerified,true);
 assert.equal(januaryPublicationPatch({meta,openMillis:now+1000,cutoffMillis,nowMillis:now}).inputState,'closed');
 assert.throws(()=>januaryPublicationPatch({meta:{...meta,publication:'published'},openMillis,cutoffMillis,nowMillis:now}));
 assert.throws(()=>januaryPublicationPatch({meta,openMillis,cutoffMillis,nowMillis:cutoffMillis}));
});
check('reviewed day signature detects owner, type, location, updated timestamp changes',()=>{
 const d={...days()[0],updatedAt:{toMillis:()=>1000}};
 assert.notEqual(januaryDaySignature(d),januaryDaySignature({...d,ownerId:'other'}));
 assert.notEqual(januaryDaySignature(d),januaryDaySignature({...d,type:'game'}));
 assert.notEqual(januaryDaySignature(d),januaryDaySignature({...d,eventLocation:'体育館'}));
 assert.notEqual(januaryDaySignature(d),januaryDaySignature({...d,updatedAt:{toMillis:()=>2000}}));
});
const ui=await readFile(new URL('./manage-january-publish.html',import.meta.url),'utf8');
const builder=await readFile(new URL('./build-staging-site.mjs',import.meta.url),'utf8');
const script=ui.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);new Function(script.replace(/^import[^\n]*;\s*$/gm,''));
assert.match(ui,/GoogleAuthProvider/);assert.match(ui,/reviewJanuaryForPublication/);
assert.match(ui,/getDocFromServer/);assert.match(ui,/runTransaction/);
assert.match(ui,/monthPublicationAudit/);assert.match(ui,/checkedDates\.size===calendarDates\(month\)\.length/);
assert.match(ui,/id="custom-window-ack"/,'administrator must confirm a nonstandard January cutoff');
assert.match(ui,/const customWindowApproved=/,'cutoff acknowledgment has a fail-closed gate');
assert.match(ui,/&&customWindowApproved\(\)/,'publish button depends on cutoff review');
assert.match(ui,/\|\|!customWindowApproved\(\)/,'publish click also rejects an unacknowledged cutoff');
assert.match(ui,/\$\('custom-window-ack'\)\.checked=false/,'changing dates resets the previous acknowledgment');
assert.match(ui,/tx\.update\(monthRef/);assert.match(ui,/tx\.update\(rosterRef/);
assert.doesNotMatch(ui,/tx\.(?:set|update|delete)\(.*(?:'months','2026-12'|'months','2027-03')/);
assert.match(builder,/'manage-january-publish\.html':'admin-january-publish\.html'/);
console.log('PASS '+n+' January-only publication preflight tests and browser script syntax');