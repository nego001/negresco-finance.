import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const cond="github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.publish_release || inputs.stable_signing)";
const expr=s=>'${{ '+s+' }}';
export function route({stable,tracked}){
 assert.equal(typeof stable,'boolean');assert.equal(typeof tracked,'boolean');
 if(stable&&!tracked)throw Error('stable requires reviewed tracked lock');
 return tracked?'reviewed-lock':'historical-preview';
}
function once(source,old,next){assert.equal(source.split(old).length,2,'unexpected workflow anchor: '+old.slice(0,70));return source.replace(old,next)}
export function propose(source){
 assert.ok(typeof source==='string');
 const marker='      - name: Require reviewed npm lockfile before any stable Android candidate\n';
 let w=once(source,marker,`      - name: Detect tracked mobile lock before installation
        id: mobile_lock
        run: |
          set -euo pipefail
          if git ls-files --error-unmatch package-lock.json >/dev/null 2>&1; then
            echo 'tracked=true' >> "$GITHUB_OUTPUT"
          else
            echo 'tracked=false' >> "$GITHUB_OUTPUT"
          fi
`+marker);
 w=once(w,'          node ../../tooling/android/verify_stable_npm_lock.cjs package.json package-lock.json\n',`          test "${expr("steps.mobile_lock.outputs.tracked")}" = true
          node ../../tooling/android/verify_stable_npm_lock.cjs package.json package-lock.json
`);
 const legacy='      - name: Install JS dependencies\n        if: '+expr('!('+cond+')')+'\n        run: npm install --no-audit --no-fund\n';
 w=once(w,legacy,'      - name: Install JS dependencies\n        if: '+expr('!('+cond+') && steps.mobile_lock.outputs.tracked == \'false\'')+'\n        run: npm install --no-audit --no-fund\n');
 const audit='      - name: Reject known npm vulnerabilities before stable dependency installation\n        if: '+expr(cond)+'\n';
 w=once(w,audit,'      - name: Reject known npm vulnerabilities before stable dependency installation\n        if: '+expr('('+cond+') || steps.mobile_lock.outputs.tracked == \'true\'')+'\n');
 const install='      - name: Install reviewed stable JS dependencies without resolving changes\n        if: '+expr(cond)+'\n        run: npm ci --no-audit --no-fund\n';
 w=once(w,install,'      - name: Install reviewed stable JS dependencies without resolving changes\n        if: '+expr("steps.mobile_lock.outputs.tracked == 'true'")+'\n        run: node ../../tooling/android/guardiao_ci_locked_install_m148.mjs install\n');
 w=once(w,'        run: npx tsc --noEmit\n','        run: node ./node_modules/typescript/bin/tsc --noEmit\n');
 w=once(w,'      - name: Generate native Android project\n        run: npx expo prebuild --platform android --non-interactive --no-install\n',`      - name: Generate native Android project
        if: ${expr("steps.mobile_lock.outputs.tracked == 'false'")}
        run: npx expo prebuild --platform android --non-interactive --no-install
      - name: Generate reviewed native Android project
        if: ${expr("steps.mobile_lock.outputs.tracked == 'true'")}
        run: node ../../tooling/android/guardiao_ci_locked_install_m148.mjs prebuild
`);
 w=once(w,"          node-version: '22'\n","          node-version: '22.23.5'\n");
 const tail='      # Expo SDK 54 includes Kotlin/KSP-heavy modules';
 assert.equal(source.split(tail).length,2);assert.equal(w.split(tail)[1],source.split(tail)[1],'downstream signing, upload or production policy changed');
 assert.equal(w.split('      - name: Validate P0 repository contracts')[0],source.split('      - name: Validate P0 repository contracts')[0].replace("node-version: '22'","node-version: '22.23.5'"));
 return w;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  assert.equal(process.argv.length,4);
  assert.equal(process.argv[2],'tooling/android/fixtures/guardiao-distribution-baseline-m161.yml.txt');
  assert.ok(process.env.RUNNER_TEMP&&process.argv[3]===process.env.RUNNER_TEMP+'/m159-candidate-workflow.txt','output must be inert CI temp file');
  writeFileSync(process.argv[3],propose(readFileSync(process.argv[2],'utf8')),{flag:'wx'});
  console.log('PASS (LAB): proposed distribution workflow generated, not activated');
 }catch(e){console.error('BLOCK (LAB): '+e.message);process.exitCode=1}
}
