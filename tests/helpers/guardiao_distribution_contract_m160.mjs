import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {propose} from '../../tooling/android/guardiao_distribution_route_m159.mjs';
const cond="github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.publish_release || inputs.stable_signing)";
const expr=s=>'${{ '+s+' }}';
const routeFile='.github/workflows/android-apk.yml';
export function verifyDistributionRoute(w){
 const baseline=execFileSync('git',['show','HEAD:'+routeFile],{encoding:'utf8'});
 const candidate=propose(baseline);
 assert.ok(w===baseline||w===candidate,'unreviewed distribution workflow');
 const lock=w.indexOf('      - name: Require reviewed npm lockfile before any stable Android candidate');
 const legacy=w.indexOf('      - name: Install JS dependencies');
 const audit=w.indexOf('      - name: Reject known npm vulnerabilities before stable dependency installation');
 const install=w.indexOf('      - name: Install reviewed stable JS dependencies without resolving changes');
 const build=w.indexOf('      - name: Build standalone test APK');
 const signing=w.indexOf('NEGRESCO_RELEASE_KEYSTORE_B64');
 assert.ok(lock>0&&lock<legacy&&legacy<audit&&audit<install&&install<build&&install<signing);
 assert.match(w,/node \.\.\/\.\.\/tooling\/android\/verify_stable_npm_lock\.cjs package\.json package-lock\.json/);
 assert.match(w,/npm audit --json --package-lock-only/);
 assert.match(w,/AUDIT_STATUS=\$\?/);
 assert.match(w,/node \.\.\/\.\.\/tooling\/android\/verify_stable_npm_audit\.cjs \/tmp\/negresco-stable-npm-audit\.json/);
 if(w===baseline){
  assert.ok(w.includes('if: '+expr(cond)));
  assert.ok(w.includes('if: '+expr('!('+cond+')')));
  assert.match(w,/run: npm ci --no-audit --no-fund/);
  assert.match(w,/run: npm install --no-audit --no-fund/);
  return 'historical';
 }
 const detection=w.indexOf('      - name: Detect tracked mobile lock before installation');
 assert.ok(detection>0&&detection<lock);
 assert.match(w,/git ls-files --error-unmatch package-lock\.json/);
 assert.ok(w.includes('test "'+expr('steps.mobile_lock.outputs.tracked')+'" = true'));
 assert.ok(w.includes('if: '+expr('!('+cond+") && steps.mobile_lock.outputs.tracked == 'false'")+"\n        run: npm install --no-audit --no-fund"));
 assert.ok(w.includes('if: '+expr('('+cond+") || steps.mobile_lock.outputs.tracked == 'true'")));
 assert.ok(w.includes('if: '+expr("steps.mobile_lock.outputs.tracked == 'true'")+"\n        run: node ../../tooling/android/guardiao_ci_locked_install_m148.mjs install"));
 assert.ok(w.includes('if: '+expr("steps.mobile_lock.outputs.tracked == 'true'")+"\n        run: node ../../tooling/android/guardiao_ci_locked_install_m148.mjs prebuild"));
 assert.doesNotMatch(w,/run: npm ci --no-audit --no-fund/);
 const h=readFileSync('tooling/android/guardiao_ci_locked_install_m148.mjs','utf8');
 assert.match(h,/verifyBytes\(manifest,lock\)/);
 assert.match(h,/stable\.verify\('package.json','package-lock.json'\),762/);
 assert.match(h,/execFileSync\('npm',\['ci','--ignore-scripts','--no-audit','--no-fund','--registry=https:\/\/registry\.npmjs\.org\/'\]/);
 assert.match(h,/adapter\(process.cwd\(\),'apply'\)/);
 assert.match(h,/prebuild changed lock bytes/);
 assert.match(h,/writeFileSync\('package.json',manifest\)/);
 assert.match(h,/adapter\(process.cwd\(\),'verify'\)/);
 return 'reviewed-proposal';
}
