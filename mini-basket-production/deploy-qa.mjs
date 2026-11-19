// Staging-only Firebase deployment wrapper. Does nothing unless --apply AND exact --confirm.
// Never targets the production Firebase project. Does not run in automated CI.
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertStagingFirebaseConfig} from './staging-config-guard.mjs';
import {getQaDefaultHostingSite} from './qa-hosting-check.mjs';

const root=dirname(fileURLToPath(import.meta.url));
export function parseQaDeployArgs(args){
 const parsed={project:null,confirm:null,apply:false};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--apply'){parsed.apply=true;continue;}
  if(!['--project','--confirm'].includes(arg))throw Error('不明な引数 '+arg);
  if(i+1>=args.length||args[i+1].startsWith('--'))throw Error(arg+' の値がありません');
  const key=arg.slice(2);
  if(parsed[key]!==null)throw Error('引数が重複しています '+arg);
  parsed[key]=args[++i];
 }
 if(!parsed.project)throw Error('--project で検証専用FirebaseのIDを指定してください');
 assertStagingFirebaseConfig({
  projectId:parsed.project,
  authDomain:parsed.project+'.firebaseapp.com',
  apiKey:'guard-check',appId:'guard-check'
 });
 if(parsed.apply&&parsed.confirm!==parsed.project)
  throw Error('検証用Firebaseへ配信する場合は --confirm に同じQAプロジェクトIDを指定してください');
 return parsed;
}
export function parseGeneratedQaConfig(source){
 const match=source.match(/export const firebaseConfig = (\{[\s\S]*?\});/);
 if(!match)throw Error('検証用Firebase構成が見つかりません');
 let data;
 try{data=JSON.parse(match[1]);}catch{throw Error('検証用構成の形式が不正です');}
 assertStagingFirebaseConfig(data);
 return data;
}
async function main(){
 const opts=parseQaDeployArgs(process.argv.slice(2));
 if(!opts.apply){
  console.log('DRY-RUN: 検証専用プロジェクト '+opts.project+' の配信準備だけ確認。通信・書込み・配信はしていません。');
  console.log('本番公開は一切行いません。実際にQAへ配信する場合だけ --confirm [同じID] --apply が必要です。');
  return;
 }
 const config=parseGeneratedQaConfig(await readFile(join(root,'dist-staging','firebase-config-staging.mjs'),'utf8'));
 if(config.projectId!==opts.project)throw Error('ビルドされた検証版と配信先のプロジェクトが不一致です');
 const [parentHtml,writeGate,rules,settings]=await Promise.all([
  readFile(join(root,'dist-staging','index.html'),'utf8'),
  readFile(join(root,'dist-staging','parent-write-config-staging.mjs'),'utf8'),
  readFile(join(root,'firestore-parent-anonymous-write-candidate.rules'),'utf8'),
  readFile(join(root,'firebase.staging.json'),'utf8')
 ]);
 if(!parentHtml.includes('🧪 検証版')||!parentHtml.includes('firebase-config-staging.mjs'))
  throw Error('検証用の保護者画面を確認できません');
 if(!writeGate.includes('PARENT_WRITES_ENABLED=true'))throw Error('検証用入力設定ではありません');
 if(!rules.includes('DO NOT DEPLOY'))
  throw Error('匿名書込み候補ルールの確認が必要です');
 const deployment=JSON.parse(settings);
 if(deployment?.firestore?.rules!=='firestore-parent-anonymous-write-candidate.rules'
   ||deployment?.hosting?.public!=='dist-staging')throw Error('QA専用の配信設定ではありません');
 // Read the installed firebase-tools CLI entry from package metadata. Invoke via node
 // so Windows does not need shell:true or fragile .cmd execution.
 const firebasePkg=JSON.parse(await readFile(join(root,'node_modules','firebase-tools','package.json'),'utf8'));
 const bin=typeof firebasePkg.bin==='string'?firebasePkg.bin:firebasePkg.bin?.firebase;
 if(typeof bin!=='string'||bin.startsWith('/')||bin.includes('..')||bin.includes('\\'))throw Error('Firebase CLIが正しくインストールされていません');
 const cli=join(root,'node_modules','firebase-tools',bin);
 if(!(await stat(cli)).isFile())throw Error('Firebase CLIをnpm installで準備してください');
 // Firebase projects created since Oct 15, 2026 may lack a default Hosting site.
 // Never create one silently; read-only preflight and fail with an actionable message.
 const {spawnSync}=await import('node:child_process');
 const inspect=spawnSync(process.execPath,[cli,'hosting:sites:list','--project',opts.project,'--json'],
  {cwd:root,encoding:'utf8',shell:false});
 if(inspect.error)throw inspect.error;
 if(inspect.status!==0)throw Error('検証用Hostingサイト一覧を取得できません：'+
  String(inspect.stderr||inspect.stdout||'').slice(0,600));
 let sites;
 try{sites=JSON.parse(inspect.stdout);}
 catch{throw Error('Hostingサイト一覧を解析できないため、安全のため配信を中止します');}
 getQaDefaultHostingSite(sites,opts.project);
 console.log('✅ 検証用デフォルトHostingサイトを確認：'+opts.project);
 console.log('=== QA ONLY DEPLOY: '+opts.project+' ===');
 console.log('Host: QA専用、Rules: 匿名入力の検証候補。管理者が承認したQAのみ対象。');
 const result=spawnSync(process.execPath,[cli,'deploy','--config','firebase.staging.json','--project',opts.project,'--only','hosting,firestore:rules'],
  {cwd:root,stdio:'inherit',shell:false});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('検証環境への配信に失敗しました：終了コード '+result.status);
 console.log('QA deploy completed for '+opts.project+'. This does not approve production release.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('QA ONLY DEPLOY REFUSED:',e.message||String(e));process.exitCode=1;});
