// QA-only browser-free regression for the annual planning demonstration.
// No network, Firebase, or production data is used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('./annual-admin-demo.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'standalone annual demo must include its own script');
new Function(script);
assert.match(html,/2027年1月〜11月を一括で仮割当/);
assert.match(html,/この端末だけに保存/);
assert.doesNotMatch(script,/firebasejs|getFirestore|initializeApp|fetch\(/);
const elements=new Map(),types={};
function fakeElement(id){
 if(elements.has(id))return elements.get(id);
 const obj={id,innerHTML:'',textContent:'',value:'',checked:false,hidden:false,disabled:false,
  dataset:{},events:{},classList:{toggle(){}},
  addEventListener(name,fn){this.events[name]=fn}};
 elements.set(id,obj);return obj;
}
for(const kind of ['practice','game','rest']){
 const e=fakeElement('type-'+kind);e.dataset.type=kind;types[kind]=e;
}
const memory={};
const ctx={
 document:{
  getElementById:fakeElement,
  querySelectorAll:selector=>selector==='[data-type]'?Object.values(types):[]
 },
 localStorage:{getItem:key=>memory[key]??null,setItem:(key,value)=>{memory[key]=value}},
 confirm:()=>true,alert:message=>{throw Error('Unexpected alert: '+message)},
 Date,Array,Object,Math,JSON,String,Number,Set,Map,Intl,console
};
vm.runInNewContext(script,ctx,{timeout:5000});
const data=()=>JSON.parse(memory['aritama-qa-annual-demo-realnames-v2']);
const months=Array.from({length:11},(_,i)=>'2027-'+String(i+1).padStart(2,'0'));
const rules={
 q01:[0,3,5,6],q02:[6],q03:[3],q04:[0,6],q05:[0,3,5,6],q06:[3],
 q07:[3,5],q08:[0,3,5],q09:[0,3,5,6],q10:[0,3,5,6],q11:[3,5],q12:[0,3,6]
};
const weekday=d=>new Date(d+'T00:00:00Z').getUTCDay();
const expectedNames=['大竹わかな','みあ','ゆい','あん','まい','こはる','なぎさ','のどか','さやか','はるか','かほ','村松さわ'];
assert.ok(expectedNames.every(name=>fakeElement('totals').innerHTML.includes('>'+name+'</b>')),'all 12 real member labels must render');
assert.doesNotMatch(fakeElement('totals').innerHTML,/テスト0[1-9]|テスト1[0-2]/,'QA placeholder names must not appear');
assert.match(html,/実際の12人の名前と曜日条件/);
assert.match(html,/Firestoreの2027年1月下書きや今後の試合予定とはまだ同期していません/);
assert.match(html,/12月分を実施済みとして加算しません/);
const generated=data();
assert.equal(Object.keys(generated.months).length,11);
const holiday=['2027-01-01','2027-01-02','2027-01-03'];
assert.ok(holiday.every(d=>generated.months['2027-01'].days[d].type==='rest'));
assert.equal(Object.values(generated.months['2027-01'].days).filter(d=>d.type==='practice').length,16);
for(const month of months){
 assert.equal(generated.months[month].published,false);
 for(const [date,day] of Object.entries(generated.months[month].days)){
  assert.ok([0,3,5,6].includes(weekday(date)));
  if(day.type==='practice'){
   assert.ok(day.owner,'every practice day gets a provisional owner: '+date);
   assert.ok(rules[day.owner].includes(weekday(date)),'hard weekday constraint: '+date+' '+day.owner);
   assert.equal(day.completed,false);
  }else{
   assert.equal(day.owner,null);
  }
 }
}
const clickDate=date=>fakeElement('calendar').events.click({target:{closest:()=>({dataset:{date}})}});
const clickMonth=month=>fakeElement('months').events.click({target:{closest:()=>({dataset:{month}})}});
const firstDate=Object.entries(generated.months['2027-01'].days).find(([d,v])=>v.type==='practice')[0];
const old=generated.months['2027-01'].days[firstDate].owner;
clickDate(firstDate);
types.game.events.click();
assert.equal(data().months['2027-01'].days[firstDate].type,'game');
assert.equal(data().months['2027-01'].days[firstDate].owner,null);
assert.equal(data().carries.length,1,'game conversion creates one carryover even before publication');
assert.equal(data().carries[0].member,old);
types.practice.events.click();
assert.equal(data().months['2027-01'].days[firstDate].owner,old);
assert.equal(data().carries.length,0,'revert game to practice removes only its unmatched carryover');
// Mark as game again, then use a later eligible day to schedule and complete the carryover.
types.game.events.click();
const now=data();
const target=months.flatMap(m=>Object.entries(now.months[m].days))
 .find(([d,day])=>d>firstDate&&day.type==='practice'&&rules[old].includes(weekday(d))&&day.owner!==old);
assert.ok(target,'replacement future duty exists');
clickMonth(target[0].slice(0,7));
clickDate(target[0]);
fakeElement('owner').value=old;
fakeElement('change').onclick();
assert.equal(data().months[target[0].slice(0,7)].days[target[0]].owner,old);
fakeElement('supplement').onclick();
assert.equal(data().carries[0].replacement,target[0]);
assert.equal(data().carries[0].resolved,false,'reassignment does NOT resolve carryover');
fakeElement('finish').onclick();
assert.equal(data().carries[0].resolved,true,'only marking duty completed resolves carryover');
fakeElement('undo').onclick();
assert.equal(data().carries[0].resolved,false,'undo returns carryover to pending');
// Publication is local-only, gated by administrator confirmation check.
fakeElement('publish').onclick();
assert.equal(data().months[target[0].slice(0,7)].published,false);
fakeElement('reviewed').onchange({target:{checked:true}});
fakeElement('publish').onclick();
assert.equal(data().months[target[0].slice(0,7)].published,true);
assert.ok(!('fetch' in ctx),'demo never needs network capability');
console.log('PASS annual QA demo: 11 months allocated, all hard weekdays, holidays, carryover only completed on duty, undo and local publish gate');
