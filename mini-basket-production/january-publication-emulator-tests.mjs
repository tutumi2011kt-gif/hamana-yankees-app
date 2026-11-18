// Standalone local emulator integration of the January-only manager publication.
// This MUST NEVER access production or QA cloud.  Only the demo-mini-basket emulator.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,runTransaction,Timestamp,serverTimestamp} from 'firebase/firestore';
import {ROSTER} from './core.mjs';
import {calendarDates,normalizeMember} from './month-draft-core.mjs';
import {jstInputOpenMillis,jstInputCutoffMillis} from './month-rollover-core.mjs';
import {reviewJanuaryForPublication,januaryPublicationPatch,januaryDaySignature} from './january-publication-core.mjs';
const env=await initializeTestEnvironment({
 projectId:'demo-mini-basket',
 firestore:{rules:await readFile('firestore-parent-anonymous-write-candidate.rules','utf8')}
});
const base='teams/aritama-mini-basket',jan='2027-01',now=Date.now();
const memberIds=ROSTER.map(m=>m.id);
const admin=env.authenticatedContext('january-manager',{firebase:{sign_in_provider:'google.com'}}).firestore();
const parent=env.authenticatedContext('new-parent-phone',{firebase:{sign_in_provider:'anonymous'}}).firestore();
const intruder=env.unauthenticatedContext().firestore();
const unapprovedGoogle=env.authenticatedContext('not-in-admin-list',{firebase:{sign_in_provider:'google.com'}}).firestore();
const disabledGoogle=env.authenticatedContext('disabled-january-admin',{firebase:{sign_in_provider:'google.com'}}).firestore();
const pathMonth=base+'/months/'+jan,rosterPath=base+'/public/roster';
const activity=calendarDates(jan);
function choose(d){return d.weekday===3?'yui':d.weekday===5?'kaho':d.weekday===6?'mia':'an'}
function row(d){return {...d,type:'practice',ownerId:choose(d),eventLocation:'',
 traineeIds:[],activityVerified:true}}
try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'admins/january-manager'),{enabled:true});
  await setDoc(doc(db,'admins/disabled-january-admin'),{enabled:false});
  await setDoc(doc(db,rosterPath),{publishedMonths:['2026-12'],
   members:ROSTER.map(m=>({id:m.id,name:m.name,kana:m.kana,status:'active'}))});
  await setDoc(doc(db,base+'/months/2026-12'),{publication:'published',inputState:'closed',scheduleStatus:'confirmed',version:11});
  await setDoc(doc(db,base+'/months/2026-12/days/2026-12-02'),{date:'2026-12-02',type:'practice',ownerId:'yui'});
  await setDoc(doc(db,base+'/months/2027-03'),{publication:'draft',inputState:'closed',version:3});
  await setDoc(doc(db,pathMonth),{publication:'draft',inputState:'closed',version:4,scheduleStatus:'awaiting-manager',
   openAt:Timestamp.fromMillis(jstInputOpenMillis(jan)),
   cutoffAt:Timestamp.fromMillis(jstInputCutoffMillis(jan))});
  for(const m of ROSTER){
   await setDoc(doc(db,base+'/members/'+m.id),{
    status:m.status,startDate:m.start,endDate:m.end,days:m.days,
    preferredWeekdays:m.preferredWeekdays||[],weekdayRule:m.weekdayRule||null,
    approvedWeekendDates:m.approvedWeekendDates||[],name:m.name,kana:m.kana
   });
  }
  for(const d of activity)await setDoc(doc(db,pathMonth+'/days/'+d.date),row(d));
 });
 // Before a manager approves January, only an enabled Google admin can update it.
 await assertFails(setDoc(doc(parent,pathMonth),{
  publication:'published',inputState:'open',version:999
 }));
 await assertFails(setDoc(doc(unapprovedGoogle,pathMonth),{
  publication:'published',inputState:'open',version:999
 }));
 await assertFails(setDoc(doc(disabledGoogle,pathMonth),{
  publication:'published',inputState:'open',version:999
 }));
 await assertFails(setDoc(doc(parent,rosterPath),{
  publishedMonths:['2026-12',jan],members:[]
 }));
 await assertFails(setDoc(doc(parent,base+'/monthPublicationAudit/spoof'),{
  month:jan,action:'publish',approvedBy:'new-parent-phone'
 }));
 await assertFails(getDoc(doc(parent,'admins/january-manager')));
 await assertFails(getDocs(collection(parent,base+'/members')));
 await assertFails(getDoc(doc(parent,pathMonth)),'anonymous visitors must not see January before approval');
 await assertFails(getDocs(collection(parent,pathMonth+'/days')));
 await assertSucceeds(getDoc(doc(parent,base+'/months/2026-12')));
 await assertFails(getDoc(doc(parent,base+'/months/2027-03')));
 const previousDec=(await getDoc(doc(admin,base+'/months/2026-12'))).data();
 const beforeJan=(await getDoc(doc(admin,pathMonth))).data();
 const beforeDays=(await getDocs(collection(admin,pathMonth+'/days'))).docs.map(s=>({date:s.id,...s.data()}));
 const rosterBefore=(await getDoc(doc(admin,rosterPath))).data();
 const membersBefore=(await getDocs(collection(admin,base+'/members'))).docs.map(s=>normalizeMember({id:s.id,...s.data()}));
 const checklist=reviewJanuaryForPublication({month:jan,meta:beforeJan,days:beforeDays,members:membersBefore,
  roster:rosterBefore,openMillis:jstInputOpenMillis(jan),cutoffMillis:jstInputCutoffMillis(jan),nowMillis:Date.parse('2026-11-18T19:00:00+09:00')});
 assert.equal(checklist.ok,true,JSON.stringify(checklist.errors));
 const signatures=new Map(beforeDays.map(d=>[d.date,januaryDaySignature(d)]));
 const oldVersion=beforeJan.version;
 const time=Date.parse('2026-11-18T19:00:00+09:00');
 await assertSucceeds(runTransaction(admin,async tx=>{
  const [adm,meta,roster]=await Promise.all([
   tx.get(doc(admin,'admins/january-manager')),tx.get(doc(admin,pathMonth)),tx.get(doc(admin,rosterPath))
  ]);
  if(!adm.exists()||adm.data().enabled!==true)throw Error('not an admin');
  if(!meta.exists()||meta.data().publication!=='draft'||meta.data().version!==oldVersion)throw Error('stale version');
  if(!roster.exists()||roster.data().publishedMonths.includes(jan))throw Error('already published');
  const snaps=[];
  for(const d of activity)snaps.push(await tx.get(doc(admin,pathMonth+'/days/'+d.date)));
  const ms=[];
  for(const id of memberIds)ms.push(await tx.get(doc(admin,base+'/members/'+id)));
  const latestDays=snaps.map((s,i)=>({date:activity[i].date,...s.data()}));
  assert.ok(latestDays.every(d=>signatures.get(d.date)===januaryDaySignature(d)));
  const latestMembers=ms.map((s,i)=>normalizeMember({id:memberIds[i],...s.data()}));
  const report=reviewJanuaryForPublication({
   month:jan,meta:meta.data(),days:latestDays,members:latestMembers,roster:roster.data(),
   openMillis:jstInputOpenMillis(jan),cutoffMillis:jstInputCutoffMillis(jan),nowMillis:time
  });
  if(!report.ok)throw Error(report.errors.join(','));
  const patch=januaryPublicationPatch({
   meta:meta.data(),openMillis:jstInputOpenMillis(jan),cutoffMillis:jstInputCutoffMillis(jan),nowMillis:time
  });
  tx.update(doc(admin,pathMonth),{...patch,
   openAt:Timestamp.fromMillis(jstInputOpenMillis(jan)),
   cutoffAt:Timestamp.fromMillis(jstInputCutoffMillis(jan)),
   version:oldVersion+1,approvedBy:'january-manager',approvedAt:serverTimestamp()});
  tx.update(doc(admin,rosterPath),{publishedMonths:['2026-12',jan]});
  tx.set(doc(collection(admin,base+'/monthPublicationAudit')),{
   month:jan,action:'publish',approvedBy:'january-manager',approvedAt:serverTimestamp()
  });
 }));
 const published=await assertSucceeds(getDoc(doc(parent,pathMonth)));
 assert.equal(published.data().publication,'published');
 assert.equal(published.data().inputState,'open');
 const displayed=await assertSucceeds(getDocs(collection(parent,pathMonth+'/days')));
 assert.equal(displayed.size,activity.length);
 const afterRoster=await assertSucceeds(getDoc(doc(parent,rosterPath)));
 assert.deepEqual(afterRoster.data().publishedMonths,['2026-12',jan]);
 assert.deepEqual((await getDoc(doc(admin,base+'/months/2026-12'))).data(),previousDec);
 assert.equal((await getDoc(doc(admin,base+'/months/2027-03'))).data().publication,'draft');
 await assertFails(getDoc(doc(parent,base+'/months/2027-03')));
 await assertFails(getDoc(doc(intruder,pathMonth)));
 await assertFails(setDoc(doc(parent,base+'/months/2026-12/days/2026-12-02'),{type:'practice',ownerId:'mia'}));
 await assert.rejects(runTransaction(admin,async tx=>{
  const snap=await tx.get(doc(admin,pathMonth));
  if(snap.data().publication!=='draft')throw Error('already published');
  tx.update(doc(admin,pathMonth),{version:999});
 }),/already published/);
 const audit=await assertSucceeds(getDocs(collection(admin,base+'/monthPublicationAudit')));
 assert.equal(audit.size,1,'approval must produce an admin audit event');
 await assertFails(getDocs(collection(parent,base+'/monthPublicationAudit')),
  'parent must not read internal approval audit');
 await assertFails(setDoc(doc(unapprovedGoogle,rosterPath),{
  publishedMonths:[jan],members:[]
 }));
 await assertFails(setDoc(doc(parent,pathMonth),{
  publication:'draft',inputState:'closed',version:1234
 }));

 console.log('PASS emulator: January 19-day manager publication atomic, anonymous reads only afterwards, December untouched, March hidden, duplicate approval blocked');
}finally{await env.cleanup();}
