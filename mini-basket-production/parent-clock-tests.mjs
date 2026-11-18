// Regression: rerender the mobile parent calendar only on data/window changes.
// Source test covers periodic timer while complete emulator tests cover request.time.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canEditMonth} from './parent-input-core.mjs';
const html=await readFile(new URL('./parent.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
new Function(script.replace(/^import[^\n]*;\s*$/gm,'')); // Browser script syntax must be valid
assert.match(script,/lastInputWindowOpen=canEditMonth\(monthData\)/);
assert.match(script,/else if\(canEditMonth\(monthData\)!==lastInputWindowOpen\)\{/);
assert.doesNotMatch(script,/\}\s*else draw\(\);\s*\},1000\);/,'do not replace iPhone tap targets each second');
assert.match(script,/まずお子さんの名前を選んでください/);

assert.match(script,/if\(writing&&pendingTap\)\{/,'during save the calendar must keep its original button DOM');
assert.match(script,/for\(const button of \$\('calendar'\)\.querySelectorAll\('button\[data-day\]'\)\)/,'only existing buttons are updated during the save');
assert.match(script,/pendingTap\.queuedToggle=!pendingTap\.queuedToggle/,'an immediate second tap queues the reverse action');
assert.match(script,/while\(pendingTap\.queuedToggle\)/,'queued reverse action is committed after the first save');
assert.match(script,/const old=overlayParentAnswers\(answers,answerOverlay\)\.find/,'a post-save tap must use committed answer overlay');
assert.match(script,/if\(field==='answers'&&!s\.metadata\.hasPendingWrites\)reconcileAnswerOverlay\(\)/,'server snapshots settle committed answer overlays');
assert.match(script,/answerOverlay\.set\(answerId\(date,person\)/,'successful cloud commits update the calendar immediately');
assert.match(script,/pendingTap=null;writing=false;draw\(\)/,'save lock ends only after every queued action');

assert.match(script,/Firestore request\.time remains authoritative/);
const open={publication:'published',inputState:'open',openAt:{toMillis:()=>1000},cutoffAt:{toMillis:()=>2000}};
assert.equal(canEditMonth(open,1500),true);
assert.equal(canEditMonth(open,2000),false);
assert.equal(canEditMonth(open,999),false);
assert.equal(canEditMonth({...open,inputState:'closed'},1500),false);
console.log('PASS stable iPhone tap targets and custom cutoff transitions');
