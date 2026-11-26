import {createRequire} from 'node:module';
import {resolve,join,dirname} from 'node:path';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {verifySyntheticGlob} from './guardiao_portable_glob_paths_m142.mjs';
const req=createRequire(resolve('package.json'));
const expo=createRequire(req.resolve('expo/package.json'));
const tmp=mkdtempSync(join(tmpdir(),'m134-glob-'));
function from(parent,name){return createRequire(parent.resolve(name+'/package.json'))}
try{
 mkdirSync(join(tmp,'assets'));writeFileSync(join(tmp,'assets','sample.txt'),'synthetic');writeFileSync(join(tmp,'assets','other.bin'),'synthetic');
 const parents=[from(req,'@expo/config'),from(req,'@expo/config-plugins'),from(req,'@expo/fingerprint'),from(req,'expo-updates'),from(expo,'@expo/cli'),from(expo,'@expo/metro-config')];
 function match(p){assert.equal(p('minimatch/package.json').version,'11.0.9');const mm=p('minimatch');assert.equal(mm.minimatch('assets/sample.txt','**/*.txt'),true);assert.equal(mm.minimatch('assets/other.bin','**/*.txt'),false);assert.equal(new mm.Minimatch('**/*.txt').match('assets/sample.txt'),true)}
 for(const p of parents){assert.equal(p('glob/package.json').version,'14.0.2');const g=p('glob');verifySyntheticGlob(await g.glob('**/*.txt',{cwd:tmp,nodir:true}));verifySyntheticGlob(g.globSync('**/*.txt',{cwd:tmp,nodir:true}));match(from(p,'glob'))}
 match(parents[2]);match(parents[4]);
 const rimraf=from(req,'rimraf');assert.equal(rimraf('glob/package.json').version,'7.2.3');
 const legacyGlob=from(rimraf,'glob');assert.equal(legacyGlob('minimatch/package.json').version,'3.1.5');
 assert.equal(legacyGlob('minimatch')('assets/sample.txt','**/*.txt'),true);
 const legacyMatch=from(legacyGlob,'minimatch');assert.equal(legacyMatch('brace-expansion/package.json').version,'1.1.22');
 const legacyBrace=from(legacyMatch,'brace-expansion');assert.equal(legacyBrace('balanced-match/package.json').version,'1.0.2');
 verifySyntheticGlob(rimraf('glob').sync('**/*.txt',{cwd:tmp,nodir:true}));
 console.log('PASS (LAB): Rimraf resolves original legacy glob and minimatch chain');
 console.log('PASS (LAB): all six actual Expo consumers resolve corrected glob and matching APIs');
}finally{rmSync(tmp,{recursive:true,force:true})}
