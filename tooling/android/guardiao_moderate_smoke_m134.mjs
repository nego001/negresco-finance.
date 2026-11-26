import {createRequire} from 'node:module';
import {resolve,join,dirname} from 'node:path';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const req=createRequire(resolve('package.json'));
const expo=createRequire(req.resolve('expo/package.json'));
const tmp=mkdtempSync(join(tmpdir(),'m134-glob-'));
function from(parent,name){return createRequire(parent.resolve(name+'/package.json'))}
try{
 mkdirSync(join(tmp,'assets'));writeFileSync(join(tmp,'assets','sample.txt'),'synthetic');writeFileSync(join(tmp,'assets','other.bin'),'synthetic');
 const parents=[from(req,'@expo/config'),from(req,'@expo/config-plugins'),from(req,'@expo/fingerprint'),from(req,'expo-updates'),from(expo,'@expo/cli'),from(expo,'@expo/metro-config')];
 function match(p){assert.equal(p('minimatch/package.json').version,'11.0.1');const mm=p('minimatch');assert.equal(mm.minimatch('assets/sample.txt','**/*.txt'),true);assert.equal(mm.minimatch('assets/other.bin','**/*.txt'),false);assert.equal(new mm.Minimatch('**/*.txt').match('assets/sample.txt'),true)}
 for(const p of parents){assert.equal(p('glob/package.json').version,'14.0.2');const g=p('glob');assert.deepEqual((await g.glob('**/*.txt',{cwd:tmp,nodir:true})).sort(),['assets/sample.txt']);assert.deepEqual(g.globSync('**/*.txt',{cwd:tmp,nodir:true}),['assets/sample.txt']);match(from(p,'glob'))}
 match(parents[2]);match(parents[4]);
 console.log('PASS (LAB): all six actual Expo consumers resolve corrected glob and matching APIs');
}finally{rmSync(tmp,{recursive:true,force:true})}
