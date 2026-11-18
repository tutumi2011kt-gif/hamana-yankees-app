// QA Hosting-only release path. Never deploys Firestore rules, data or functions.
// Usage (after build-staging-site.mjs):
// node deploy-qa-hosting-only.mjs --project <QA_ID> --confirm <same_QA_ID> --apply
// Without --apply this performs a local dry-run and does not access Firebase.
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQaDeployArgs,parseGeneratedQaConfig} from './deploy-qa.mjs';
import {getQaDefaultHostingSite} from './qa-hosting-check.mjs';

const root=dirname(fileURLToPath(import.meta.url));

export function hostingOnlyCliArgs(projectId){
  parseQaDeployArgs(['--project',projectId]);
  // The --only selector is deliberately fixed. Do not reuse the legacy
  // hosting,firestore:rules deployment path for a UI-only QA update.
  return ['deploy','--config','firebase.staging.json','--project',projectId,'--only','hosting'];
}

export function validateQaHostingBuild({projectId,generatedConfig,indexHtml,writeGate,settings}){
  const config=parseGeneratedQaConfig(generatedConfig);
  if(config.projectId!==projectId)throw Error('QA配信先と生成済みWeb設定のプロジェクトIDが一致しません');
  if(!indexHtml.includes('🧪 検証版')||!indexHtml.includes('firebase-config-staging.mjs'))
    throw Error('QA専用の保護者画面ではありません');
  if(!writeGate.includes('PARENT_WRITES_ENABLED=true'))
    throw Error('QA専用入力設定を確認できません');
  const month=indexHtml.indexOf('② 月を選ぶ');
  const input=indexHtml.indexOf('③ ×・○の希望入力');
  const x=indexHtml.indexOf('❌ 当番ができない日');
  const o=indexHtml.indexOf('⭕ 代わりにできる日');
  const cal=indexHtml.indexOf('id="calendar-title"');
  if(!(month>=0&&month<input&&input<x&&input<o&&o<cal))
    throw Error('最新の回答ボタン文言・配置をQAビルドで確認できません');
  let deployment;
  try{deployment=JSON.parse(settings);}catch{throw Error('QA専用Hosting設定のJSONが不正です');}
  if(!deployment||Array.isArray(deployment.hosting)||
     deployment.hosting?.public!=='dist-staging'||
     deployment.hosting?.site||deployment.hosting?.target)
    throw Error('QA Hosting配信設定が想定外です');
  return config.projectId;
}

async function main(){
  const options=parseQaDeployArgs(process.argv.slice(2));
  const cliArgs=hostingOnlyCliArgs(options.project);
  if(!options.apply){
    console.log('DRY-RUN: '+options.project+' のQA Hostingだけが対象です。Firebaseへの接続・デプロイはしていません。');
    console.log('実際に配信するには --confirm '+options.project+' --apply が必要です。');
    return;
  }
  const [generatedConfig,indexHtml,writeGate,settings]=await Promise.all([
    readFile(join(root,'dist-staging','firebase-config-staging.mjs'),'utf8'),
    readFile(join(root,'dist-staging','index.html'),'utf8'),
    readFile(join(root,'dist-staging','parent-write-config-staging.mjs'),'utf8'),
    readFile(join(root,'firebase.staging.json'),'utf8')
  ]);
  validateQaHostingBuild({projectId:options.project,generatedConfig,indexHtml,writeGate,settings});
  const firebasePkg=JSON.parse(await readFile(join(root,'node_modules','firebase-tools','package.json'),'utf8'));
  const bin=typeof firebasePkg.bin==='string'?firebasePkg.bin:firebasePkg.bin?.firebase;
  if(typeof bin!=='string'||bin.startsWith('/')||bin.includes('..')||bin.includes('\\'))
    throw Error('Firebase CLIのインストールを確認できません');
  const cli=join(root,'node_modules','firebase-tools',bin);
  if(!(await stat(cli)).isFile())throw Error('Firebase CLIがありません。npm install --ignore-scripts を実施してください');
  const {spawnSync}=await import('node:child_process');
  const inspected=spawnSync(process.execPath,[cli,'hosting:sites:list','--project',options.project,'--json'],
    {cwd:root,encoding:'utf8',shell:false});
  if(inspected.error)throw inspected.error;
  if(inspected.status!==0)throw Error('QA専用Hosting一覧の読み取りに失敗しました：'+String(inspected.stderr||inspected.stdout||'').slice(0,400));
  let payload;
  try{payload=JSON.parse(inspected.stdout);}catch{throw Error('QA Hosting一覧を解析できず中止しました');}
  getQaDefaultHostingSite(payload,options.project);
  console.log('QA Hosting-only: '+options.project+'。Firestoreルール・データ・Cloud Functionsは対象外です。');
  const deployed=spawnSync(process.execPath,[cli,...cliArgs],{cwd:root,stdio:'inherit',shell:false});
  if(deployed.error)throw deployed.error;
  if(deployed.status!==0)throw Error('QA Hostingだけの配信に失敗：終了コード '+deployed.status);
  console.log('QA Hosting-only deployment completed. 本番公開・Firestore更新は行っていません。');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error('QA HOSTING ONLY DEPLOY REFUSED:',error.message||String(error));process.exitCode=1;});
