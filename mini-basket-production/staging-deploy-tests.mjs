// QA deploy is opt-in; unit tests must never invoke firebase deploy.
import assert from 'node:assert/strict';
import {parseQaDeployArgs,parseGeneratedQaConfig} from './deploy-qa.mjs';
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
