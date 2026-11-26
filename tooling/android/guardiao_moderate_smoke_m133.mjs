import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const req=createRequire(resolve('package.json'));
const expo=createRequire(req.resolve('expo/package.json'));
const parents=[req,expo];
const tmp=mkdtempSync(join(tmpdir(),'m133-glob-'));
try{
 mkdirSync(join(tmp,'assets'));writeFileSync(join(tmp,'assets','sample.txt'),'synthetic');writeFileSync(join(tmp,'assets','other.bin'),'synthetic');
 const glob=req('glob');assert.deepEqual((await glob.glob('**/*.txt',{cwd:tmp,nodir:true})).sort(),['assets/sample.txt']);
 assert.deepEqual(glob.globSync('**/*.txt',{cwd:tmp,nodir:true}),['assets/sample.txt']);
 for(const parent of parents){const mm=parent('minimatch');assert.equal(mm.minimatch('assets/sample.txt','**/*.txt'),true);assert.equal(mm.minimatch('assets/other.bin','**/*.txt'),false);assert.equal(new mm.Minimatch('**/*.txt').match('assets/sample.txt'),true);}
 console.log('PASS (LAB): synthetic glob async/sync and minimatch API checks');
}finally{rmSync(tmp,{recursive:true,force:true})}
