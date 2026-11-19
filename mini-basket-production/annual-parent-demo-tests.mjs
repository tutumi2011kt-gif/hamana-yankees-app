// Browser-free integration test for the two QA-only localStorage annual demo pages.
// This cannot reach Firebase or modify production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const admin=await readFile(new URL('./annual-admin-demo.html',import.meta.url),'utf8');
const parent=await readFile(new URL('./annual-parent-demo.html',import.meta.url),'utf8');
const adminJs=admin.match(/<script>([\s\S]*?)<\/script>/)?.[1],parentJs=parent.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(adminJs&&parentJs);
new Function(adminJs);
new Function(parentJs);
assert.doesNotMatch(adminJs+parentJs,/firebasejs|getFirestore|initializeApp|fetch\s*\(/i);
assert.match(admin,/\.\/annual-parent-demo\.html/);
assert.match(parent,/\.\/annual-admin-demo\.html/);
const store=new Map();
const key='aritama-qa-annual-demo-realnames-v2';
const localStorage={
 getItem:k=>store.get(k)||null,
 setItem:(k,value)=>store.set(k,value)
};
function makeDocument(){
 const elements=new Map(),modes={};
 function el(id){
  if(elements.has(id))return elements.get(id);
  const e={id,innerHTML:'',textContent:'',value:'',checked:false,hidden:false,disabled:false,
   className:'',dataset:{},events:{},classList:{toggle(){}},
   addEventListener(n,fn){this.events[n]=fn},closest(){return this}};
  elements.set(id,e);return e;
 }
 for(const t of ['practice','game','rest'])modes[t]=el('type-'+t),modes[t].dataset.type=t;
 return {el,modes,document:{
  getElementById:el,
  querySelectorAll:selector=>selector==='[data-type]'?Object.values(modes):[]
 }};
}
const a=makeDocument(),p=makeDocument(),subscribers={};
function createCtx(fixture){
 return {document:fixture.document,localStorage,
  confirm:()=>true,alert:s=>{throw Error('Unexpected alert '+s)},
  window:{addEventListener:(event,fn)=>{if(!subscribers[event])subscribers[event]=[];subscribers[event].push(fn)}},
  Date,Array,Object,Math,JSON,String,Number,Set,Map,Intl,console};
}
vm.runInNewContext(adminJs,createCtx(a),{timeout:5000});
vm.runInNewContext(parentJs,createCtx(p),{timeout:5000});
const data=()=>JSON.parse(store.get(key));
assert.ok(data());
assert.equal(data().months['2027-01'].published,false);
assert.equal(p.el('calendar').innerHTML,'','unpublished months are hidden in parent UI');
// Manager's publication is a LOCAL ONLY simulation gated by the reviewed checkbox.
a.el('publish').onclick();
assert.equal(data().months['2027-01'].published,false);
a.el('reviewed').onchange({target:{checked:true}});
a.el('publish').onclick();
assert.equal(data().months['2027-01'].published,true);
p.el('refresh').onclick();
assert.ok(p.el('calendar').innerHTML.includes('data-date="2027-01-06"'));
assert.ok(!p.el('calendar').innerHTML.includes('data-date="2027-02-03"'),'unpublished months hidden');
const days=data().months['2027-01'].days;
const date=Object.keys(days).find(d=>days[d].type==='practice');
const owner=days[date].owner;
assert.ok(owner);
const parentDateClick=()=>p.el('calendar').events.click({target:{closest:()=>({dataset:{date}})}});
p.el('person').value=owner;
p.el('person').onchange();
p.el('mode-x').onclick();
parentDateClick();
assert.equal(data().months['2027-01'].answers[date][owner],'x','owner can register unavailable x');
parentDateClick();
assert.ok(!data().months['2027-01'].answers[date]?.[owner],'second tap removes owner x');
parentDateClick();
assert.equal(data().months['2027-01'].answers[date][owner],'x');
assert.ok(p.el('calendar').innerHTML.includes('mine-x'),'own-answer border must remain');
let other=owner==='q02'?'q03':'q02';
p.el('person').value=other;
p.el('person').onchange();
p.el('mode-o').onclick();
parentDateClick();
assert.equal(data().months['2027-01'].answers[date][other],'o','voluntary o is allowed regardless of normal weekdays');
assert.ok(p.el('calendar').innerHTML.includes(' ○'),'volunteer name and mark displayed');
assert.ok(!p.el('calendar').innerHTML.includes('自分：'),'own o must not add a duplicate line');
assert.ok(p.el('calendar').innerHTML.includes('mine-o'),'own o border must remain');

assert.ok(p.el('calendar').innerHTML.includes(' ×'),'original owner retains x');
assert.ok(!p.el('calendar').innerHTML.includes('自分：'),'parent day label must not duplicate self x/o');

p.el('mode-x').onclick();
parentDateClick();
assert.equal(data().months['2027-01'].answers[date][other],'o','non-owner may not register x');
// Parent response can be read by manager after storage update.
assert.ok(subscribers.storage?.length===2);
for(const fn of subscribers.storage)fn({key});
assert.match(a.el('calendar').innerHTML,/元担当 ×/);
assert.match(a.el('calendar').innerHTML,/○候補 1人/);
p.el('mode-o').onclick();
parentDateClick();
assert.equal(data().months['2027-01'].answers[date][other],undefined,'re-tap o deletes it');
// Practice to game drops interaction on the parent screen (no Firestore change).
a.el('calendar').events.click({target:{closest:()=>({dataset:{date}})}});
a.modes.game.events.click();
for(const fn of subscribers.storage)fn({key});
assert.equal(data().months['2027-01'].days[date].type,'game');
assert.ok(p.el('calendar').innerHTML.includes('data-date="'+date+'" disabled'), 'game remains visible with a disabled day button');
p.el('mode-o').onclick();
parentDateClick();
assert.equal(data().months['2027-01'].answers[date][other],undefined, 'game days cannot receive new voluntary answers');
console.log('PASS annual parent demo: private local publication, x/o input and re-tap cancellation, admin marks, weekday-unrestricted o, game protection');
