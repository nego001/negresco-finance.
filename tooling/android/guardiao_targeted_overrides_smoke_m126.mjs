import {createRequire} from 'node:module';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
const appRequire=createRequire(resolve('package.json'));
const metroPath=appRequire.resolve('metro/package.json');
const metroRequire=createRequire(metroPath);
const expoRequire=createRequire(appRequire.resolve('expo/package.json'));
const configPath=expoRequire.resolve('@expo/metro-config/package.json');
const configRequire=createRequire(configPath);
const image=metroRequire('image-size');
const css=configRequire('postcss');
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=','base64');
const tmp=mkdtempSync(join(tmpdir(),'m126-synthetic-'));
try{
 const path=join(tmp,'pixel.png');writeFileSync(path,bytes);
 const assets=metroRequire(join(dirname(metroPath),'src','Assets.js'));
 const result=await assets.getAssetData(path,'assets/pixel.png',[],null,'/assets');
 assert.equal(result.width,1);assert.equal(result.height,1);
 const config=configRequire('@expo/metro-config');assert.equal(typeof config.getDefaultConfig,'function');
 const root=css.parse('.synthetic { color: red; }');
 assert.equal(root.first.first.prop,'color');
 assert.equal(root.first.first.value,'red');
 assert.equal(typeof image.imageSize==='function'||typeof image==='function',true);
 console.log('PASS (LAB): Metro real asset pipeline and Expo-resolved PostCSS synthetic parse');
}finally{rmSync(tmp,{recursive:true,force:true})}
