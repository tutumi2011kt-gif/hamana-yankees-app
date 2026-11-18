// Pure QA readiness checks: no Firebase SDK, no network, no writes.
// These checks are intentionally strict for freshly seeded isolated QA data.
import {makeQaFixture,QA_PUBLISHED_MONTH,QA_DRAFT_MONTH,QA_TEAM_ID} from './staging-fixture-core.mjs';
import {assertStagingFirebaseConfig} from './staging-config-guard.mjs';

const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const toMillis=value=>{
 if(value&&typeof value.toMillis==='function')return value.toMillis();
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(value&&typeof value.seconds==='number')return value.seconds*1000+Math.floor((value.nanoseconds??0)/1e6);
 return NaN;
};
function hasOnlyFictitiousNames(names){
 return names.length===12&&names.every(x=>typeof x==='string'&&/^テスト(0[1-9]|1[0-2])$/.test(x))
  &&new Set(names).size===12;
}
export function checkQaReadiness({projectId,snapshot,nowMillis=Date.now()}){
 assertStagingFirebaseConfig({
  projectId,authDomain:projectId+'.firebaseapp.com',
  apiKey:'readiness-check-only',appId:'readiness-check-only'
 });
 const expected=makeQaFixture(projectId);
 const checks=[];
 const add=(code,ok,detail,level='error')=>checks.push({code,ok:!!ok,detail,level});
 const s=isObj(snapshot)?snapshot:{};
 add('project','true'===String(!!projectId),'検証用プロジェクト：'+projectId);
 add('marker',s.marker?.qaOnly===true&&s.marker.projectId===projectId
  &&s.marker.version===1,'検証用データの初期化マーカーが一致すること');
 add('admin',s.admin?.enabled===true&&s.admin?.qaOnly===true,
  'Google管理者のQA権限が有効で、検証専用であること');
 const names=Array.isArray(s.members)?s.members.map(x=>x?.name):[];
 add('members',hasOnlyFictitiousNames(names)&&
   s.members.every(x=>x?.status==='active'&&x?.startDate==='2026-12-01'),
   '架空のテスト01〜12が在籍し、実在の名前を使用していないこと');
 const roster=s.roster;
 add('roster',Array.isArray(roster?.members)
   &&hasOnlyFictitiousNames(roster.members.map(x=>x?.name))
   &&roster.qaOnly===true,
   '公開用名簿は架空12名であること');
 const visible=roster?.publishedMonths;
 add('publishedMonths',Array.isArray(visible)&&visible.length===1&&visible[0]===QA_PUBLISHED_MONTH,
   '公開対象は2027年1月のみ（未承認の3月は含まない）');
 const jan=s.months?.[QA_PUBLISHED_MONTH],mar=s.months?.[QA_DRAFT_MONTH];
 const expectedJanuary=expected.entries.find(x=>x.path==='teams/'+QA_TEAM_ID+'/months/'+QA_PUBLISHED_MONTH)?.data;
 const janOpen=toMillis(jan?.openAt),janCutoff=toMillis(jan?.cutoffAt);
 const tokyoTime=millis=>Number.isFinite(millis)
  ?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'short',timeStyle:'short',hour12:false}).format(millis)
  :'未設定';
 add('january',jan?.publication==='published'&&jan?.inputState==='open',
   '2027年1月が公開済み・入力受付状態であること');
 add('windowOrder',Number.isFinite(janOpen)&&Number.isFinite(janCutoff)&&janOpen<janCutoff,
   '1月の受付開始・締切が有効で、開始時刻が締切より前であること');
 add('customInputWindow',janOpen===expectedJanuary.openAtMillis&&janCutoff===expectedJanuary.cutoffAtMillis,
   '1月の入力期間の標準設定：受付開始 '+tokyoTime(expectedJanuary.openAtMillis)+'／締切 '+tokyoTime(expectedJanuary.cutoffAtMillis)+
   '。現在：開始 '+tokyoTime(janOpen)+'／締切 '+tokyoTime(janCutoff)+'。標準と異なる場合は管理者変更の意図を確認してください',
   'warning');
 add('inputWindow',jan?.publication==='published'
   &&toMillis(jan.openAt)<=nowMillis&&nowMillis<toMillis(jan.cutoffAt),
   'サーバーの現在時刻が1月分の入力受付期間にあること');
 add('march',mar?.publication==='draft'&&mar?.scheduleVerified===false
   &&mar?.inputState==='closed',
   '2027年3月が未確認の管理者専用下書きであること');
 const janDays=Array.isArray(s.days?.[QA_PUBLISHED_MONTH])?s.days[QA_PUBLISHED_MONTH]:[];
 const marchDays=Array.isArray(s.days?.[QA_DRAFT_MONTH])?s.days[QA_DRAFT_MONTH]:[];
 add('januaryDays',janDays.length===expected.janDays.length&&janDays.every(d=>
   d.date?.startsWith('2027-01-')&&
   ((d.type==='practice'&&typeof d.ownerId==='string'&&d.ownerId.startsWith('qa'))
    ||((d.type==='game'||d.type==='rest')&&d.ownerId==null))),
   '1月の日程は練習担当1人、試合・休みは担当なし');
 add('marchDays',marchDays.length===expected.marchDays.length
   &&marchDays.every(d=>d.date?.startsWith('2027-03-')
    &&d.activityVerified===false&&d.ownerId==null),
   '3月は全日未確認・担当者なし');
 // A pre-existing parent answer may be legitimate during a test session.
 const unexpected=Array.isArray(s.unexpectedMonthIds)?s.unexpectedMonthIds:[];
 add('unexpectedMonths',unexpected.length===0,
   '今回の検証用シナリオ以外に予期しない月がないこと', 'warning');
 return {
  projectId,teamId:QA_TEAM_ID,pass:checks.every(x=>x.ok||x.level==='warning'),
  blockers:checks.filter(x=>!x.ok&&x.level==='error').map(x=>x.code),
  warnings:checks.filter(x=>!x.ok&&x.level==='warning').map(x=>x.code),
  checks
 };
}
export function qaReadinessReport(result){
 const lines=[
  '🏀 有玉女子ミニバス・検証専用Firebaseの読み取り点検',
  '対象：'+result.projectId+'／本番 aritama-mini-basket は対象外',
  '総合：'+(result.pass?'準備OK（次は実機操作試験）':'要修正（検証版の公開・操作試験へ進まない）'),
  ...result.checks.map(c=>(c.ok?'✅':c.level==='warning'?'⚠':'❌')+' '+c.detail)
 ];
 lines.push('※ これはFirestoreの初期状態の読み取り点検です。匿名認証設定、ネットワーク反映速度、iPhone実機操作の検証ではありません。');
 return lines.join('\n');
}
