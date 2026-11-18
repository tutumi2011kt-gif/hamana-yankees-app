// Builds a self-contained set of browser pages pointed ONLY at an isolated Firebase project.
// Does not deploy anything, enable billing, change production rules, or edit source files.
// Usage: STAGING_FIREBASE_CONFIG_JSON='{"apiKey":"...","authDomain":"...-qa.firebaseapp.com","projectId":"...-qa","appId":"..."}' node build-staging-site.mjs
import {readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseAndCheckStagingFirebaseConfig,assertStagingFirebaseConfig} from './staging-config-guard.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const out=join(root,'dist-staging');
const sourcePages=Object.freeze({
 'parent.html':'index.html',
 'manage-month-approval.html':'admin-approve.html',
 'manage-january-publish.html':'admin-january-publish.html',
 'review-january.html':'admin-review-january.html',
 'manage-swaps.html':'admin-swaps.html',
 'manage-parent-answers.html':'admin-answers.html',
 'manage-duty-ledger.html':'admin-ledger.html',
 'manage-deadline.html':'admin-deadline.html',
 'manage-answer-monitor.html':'admin-monitor.html',
 'admin-qa-health.html':'admin-qa-health.html'
});
export const isSafeImportPath=(src)=>src.startsWith('./')&&!src.includes('..')&&!src.includes('\\')&&!src.startsWith('//');
const importRe=/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
function dependencies(source){
 const matches=[...source.matchAll(importRe)].map(m=>m[1].split('?')[0].split('#')[0]);
 return [...new Set(matches)].filter(isSafeImportPath);
}
export function stageHtml(source,title){
 if(!source.includes("from './firebase-config.mjs'"))
  throw new Error(title+' のFirebase設定importが見つかりません');
 let html=source.replaceAll("from './firebase-config.mjs'","from './firebase-config-staging.mjs'");
 if(html.includes("from './parent-write-config.mjs?v=1'"))
  html=html.replaceAll("from './parent-write-config.mjs?v=1'","from './parent-write-config-staging.mjs?v=1'");
 if(html.includes("from './parent-write-config.mjs'"))
  html=html.replaceAll("from './parent-write-config.mjs'","from './parent-write-config-staging.mjs'");
 if(!html.includes('initializeApp(firebaseConfig'))throw new Error(title+' はFirebaseアプリを初期化できません');
  // Inject before initialization, after imports and in the script body.
 if(!html.includes("from './firebase-config-staging.mjs'"))throw new Error('staging import rewrite failed');
 html=html.replace("from './firebase-config-staging.mjs';","from './firebase-config-staging.mjs';\nimport {assertStagingFirebaseConfig} from './staging-config-guard.mjs';");
 // Validate at the exact initializeApp call site; the 7 admin pages have different setup syntax.
 if((html.match(/initializeApp\(firebaseConfig/g)||[]).length!==1)throw new Error(title+' のFirebase初期化回数が想定外です');
 html=html.replace('initializeApp(firebaseConfig','initializeApp((assertStagingFirebaseConfig(firebaseConfig),firebaseConfig)');
 html=html.replace(/<title>/i,'<title>【検証版】');
 const ribbon='<div style="position:sticky;top:0;z-index:999;background:#963c12;color:white;border-radius:8px;padding:8px 10px;font-weight:800;text-align:center">🧪 検証版・架空のデータ専用／本番とは別のFirebase</div>';
 if(html.includes('<body><main>'))html=html.replace('<body><main>','<body><main>'+ribbon);
 else if(html.includes('<h1>'))html=html.replace('<h1>',ribbon+'<h1>');
 else throw new Error(title+' に検証版の警告表示を挿入できません');
 return html;
}
async function main(){
 const config=parseAndCheckStagingFirebaseConfig(process.env.STAGING_FIREBASE_CONFIG_JSON);
 const project=assertStagingFirebaseConfig(config);
 // Fail before doing any work if the requested destination is unsafe.
 if(relative(root,out)!=='dist-staging')throw new Error('出力先が不正です');
 await rm(out,{recursive:true,force:true});
 await mkdir(out,{recursive:true});
 const pending=new Set(['staging-config-guard.mjs']);
 const pagesWritten=[];
 for(const [input,output] of Object.entries(sourcePages)){
  const html=stageHtml(await readFile(join(root,input),'utf8'),input);
  // From HTML, copy only locally imported browser modules (never private/admin tests).
  for(const dep of dependencies(html))pending.add(dep.slice(2));
  await writeFile(join(out,output),html);
  pagesWritten.push(output);
 }
 // Staging config is generated only from the separately selected isolated project.
 await writeFile(join(out,'firebase-config-staging.mjs'),
  '// Generated for dedicated QA Firebase only. This config contains public Firebase Web identifiers.\n'+
  'export const firebaseConfig = '+JSON.stringify(config,null,2)+';\n'+
  "export const teamId = 'aritama-mini-basket';\n");
 await writeFile(join(out,'parent-write-config-staging.mjs'),
  "// QA-only. The build is rejected if projectId is the live project. Not to be copied into production.\n"+
  "export const ANSWER_PUBLICATION_MODE='instant';\nexport const PARENT_WRITES_ENABLED=true;\n"+
  "export const ACCOUNT_REQUIRED=false;\nexport const REGISTRATION_REQUIRED=false;\n");
 const copied=new Set();
 while(pending.size){
  const next=pending.values().next().value;pending.delete(next);
  if(copied.has(next))continue;
  copied.add(next);
  if(next==='firebase-config-staging.mjs'||next==='parent-write-config-staging.mjs')continue; // Generated in dist, not read from production source.
  if(next==='firebase-config.mjs'||next==='parent-write-config.mjs')
   throw new Error('誤って本番設定を公開対象へ含めようとしました');
  if(!next.endsWith('.mjs')||next.includes('..')||next.startsWith('/'))
   throw new Error('不正なモジュール依存: '+next);
  const sourcePath=join(root,next);
  if(!(await stat(sourcePath)).isFile())throw new Error('依存モジュールがありません: '+next);
  const text=await readFile(sourcePath,'utf8');
  for(const dep of dependencies(text))pending.add(dep.slice(2));
  const dest=join(out,next);
  await mkdir(dirname(dest),{recursive:true});
  await writeFile(dest,text);
 }
 const generatedFiles=await Promise.all([...pagesWritten, ...['firebase-config-staging.mjs','parent-write-config-staging.mjs','staging-config-guard.mjs']].map(p=>stat(join(out,p)).then(()=>p)));
 const pageIndex='<html lang="ja"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">'+
 '<title>検証用メニュー</title><style>body{font:16px sans-serif;max-width:500px;margin:40px auto;padding:16px}a{display:block;padding:14px;margin:8px 0;border-radius:9px;border:1px solid #ccc}h1{font-size:20px}</style>'+
 '<h1>🏀 有玉ミニバス 検証専用メニュー</h1><p>検証用プロジェクト '+project+' に接続します。本番とは別です。</p>'+
 Object.values(sourcePages).map(p=>'<a href="./'+p+'">'+p+'</a>').join('')+'</html>';
 await writeFile(join(out,'qa-menu.html'),pageIndex);
 console.log('STAGING BUILD SUCCESS: '+project+' ('+generatedFiles.length+' core files plus imported modules), output=dist-staging');
 console.log('This command did NOT deploy or touch production Firebase. Real staging credentials & authorized domains are required for login.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(err=>{console.error(err.message);process.exitCode=1;});
