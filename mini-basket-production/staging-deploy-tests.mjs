// QA deploy is opt-in; unit tests must never invoke firebase deploy.
import assert from 'node:assert/strict';
import {parseQaDeployArgs,parseGeneratedQaConfig} from './deploy-qa.mjs';
import {hostingOnlyCliArgs,validateQaHostingBuild} from './deploy-qa-hosting-only.mjs';
const checked=parseQaDeployArgs(['--project','basket-staging-qa']);
assert.equal(checked.project,'basket-staging-qa');
assert.equal(checked.apply,false,'default must be no-deploy');
assert.throws(()=>parseQaDeployArgs(['--project','aritama-mini-basket']));
assert.throws(()=>parseQaDeployArgs(['--project','basket-staging-qa','--apply']));
assert.throws(()=>parseQaDeployArgs(['--project','basket-staging-qa','--confirm','basket-staging-test','--apply']));
assert.throws(()=>parseQaDeployArgs(['--project','basket-staging-qa','--confirm','basket-staging-qa','--apply','--unknown']));
const approved=parseQaDeployArgs(['--project','basket-staging-qa','--confirm','basket-staging-qa','--apply']);
assert.equal(approved.apply,true,'only explicit double-confirmed QA may be deployed');
const config={
 apiKey:'dummy-web-key',projectId:'basket-staging-qa',
 authDomain:'basket-staging-qa.firebaseapp.com',appId:'qa-test'
};
const good=parseGeneratedQaConfig('export const firebaseConfig = '+JSON.stringify(config,null,2)+';\n');
assert.equal(good.projectId,approved.project);
assert.throws(()=>parseGeneratedQaConfig('export const firebaseConfig = '+JSON.stringify({...config,projectId:'aritama-mini-basket'})+';'));
assert.throws(()=>parseGeneratedQaConfig('export const firebaseConfig = '+JSON.stringify({...config,authDomain:'aritama-mini-basket.firebaseapp.com'})+';'));
console.log('PASS staging deploy defaults to dry-run, blocks production and requires matching QA config plus double confirmation');

const hostingOnly=hostingOnlyCliArgs('basket-staging-qa');
assert.deepEqual(hostingOnly,[
 'deploy','--config','firebase.staging.json','--project','basket-staging-qa','--only','hosting'
],'QA UI redeploy must never target Firestore rules, data or functions');
assert.throws(()=>hostingOnlyCliArgs('aritama-mini-basket'));
assert.throws(()=>hostingOnlyCliArgs('some-unrelated-project'));
const qaHtml='<div>🧪 検証版</div><script src="./firebase-config-staging.mjs"></script>'+
 '<h2>② 月を選ぶ</h2><h2>③ ×・○の希望入力</h2>'+
 '<button>❌ 当番ができない日</button><button>⭕ 代わりにできる日</button>'+
 '<h2 id="calendar-title">当番カレンダー</h2>';
const generatedConfig='export const firebaseConfig = '+JSON.stringify(config)+';';
const qaBuild={
 projectId:'basket-staging-qa',generatedConfig,indexHtml:qaHtml,
 writeGate:'export const PARENT_WRITES_ENABLED=true;',
 settings:JSON.stringify({hosting:{public:'dist-staging'},firestore:{rules:'candidate.rules'}})
};
assert.equal(validateQaHostingBuild(qaBuild),'basket-staging-qa');
assert.throws(()=>validateQaHostingBuild({...qaBuild,projectId:'aritama-mini-basket'}));
assert.throws(()=>validateQaHostingBuild({...qaBuild,writeGate:'export const PARENT_WRITES_ENABLED=false;'}));
assert.throws(()=>validateQaHostingBuild({...qaBuild,indexHtml:qaHtml.replace('⭕ 代わりにできる日','誤ったボタン')}));
assert.throws(()=>validateQaHostingBuild({...qaBuild,settings:JSON.stringify({hosting:{public:'dist-staging',site:'aritama-mini-basket-qa'}})}));
console.log('PASS QA Hosting-only deployment is project-guarded and never changes Firestore');
