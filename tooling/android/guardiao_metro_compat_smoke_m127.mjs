import {createRequire} from 'node:module';
import {resolve,dirname,join} from 'node:path';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const req=createRequire(resolve('package.json'));
const p=req.resolve('metro/package.json');
const assets=req(join(dirname(p),'src','Assets.js'));
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64');
const tmp=mkdtempSync(join(tmpdir(),'m127-assets-'));
try{
 const png=join(tmp,'sample.png'),txt=join(tmp,'sample.txt');
 writeFileSync(png,pixel);writeFileSync(txt,'synthetic');
 assert.deepEqual(assets.getAssetSize('png',pixel,png),{width:1,height:1});
 const a=await assets.getAssetData(png,'assets/sample.png',[],null,'/assets');
 assert.equal(a.width,1);assert.equal(a.height,1);
 const b=await assets.getAssetData(txt,'assets/sample.txt',[],null,'/assets');
 assert.equal(b.width,undefined);assert.equal(b.height,undefined);
 assert.throws(()=>assets.getAssetSize('png',Buffer.alloc(0),png));
 console.log('PASS (LAB): Metro buffer, real PNG, nonimage and empty-image paths verified');
}finally{rmSync(tmp,{recursive:true,force:true})}
