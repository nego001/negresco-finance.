#!/usr/bin/env node
'use strict';

// Source-level change detector only. Android compiled APK metadata is
// independently audited; this is not a substitute for runtime OTA signing.
const fs=require('node:fs');
const path=require('node:path');

const SCRIPT_EXT=/\.(?:js|jsx|mjs|cjs|ts|tsx|kt|java)$/i;
const BLOCKED=[
  ['JavaScript expo-updates module import', /\b(?:from\s*['"]expo-updates(?:\/[^'"]*)?['"]|(?:import|require)\s*\(\s*['"]expo-updates(?:\/[^'"]*)?['"]\s*\))/],
  ['native Expo Updates package reference', /expo[.]modules[.]updates/],
  ['native Expo Updates controller access', /\b(?:UpdatesController|UpdatesConfiguration|EXUpdatesAppController)\b/],
  ['OTA runtime URL/header override API', /\b(?:setUpdateURLAndRequestHeadersOverride|setUpdateURLOverride|setRequestHeadersOverride|setExtraParamAsync|setUpdateRequestHeaders)\b/],
  ['dynamic update metadata override', /(?:\bUpdates\b|expoUpdates)\s*(?:\?\.|\.)\s*(?:set|override|configure)[A-Za-z_]*\s*\(/]
];
const IGNORE_DIR=new Set(['node_modules','.git','.expo','.gradle','build','dist','coverage']);
const MAX_FILES=10000;
const MAX_FILE_SIZE=1024*1024;

function excluded(relative) {
  const parts=relative.split('/');
  if(parts.some(x=>IGNORE_DIR.has(x)))return true;
  // Expo generates the entire Android app during prebuild. Compiled APK
  // checks remain authoritative for generated native project contents.
  if(relative.startsWith('android/'))return true;
  if(relative.startsWith('plugins/'))return true;
  if(/\/android\/src\/(?:androidTest|test|debug)\//.test('/'+relative))return true;
  return false;
}

function inspectSource(content,relative){
  const problems=[];
  for(const [rule,regex] of BLOCKED){
    const match=regex.exec(content);
    if(match){
      const line=content.slice(0,match.index).split('\n').length;
      problems.push(relative+':'+line+' '+rule);
    }
  }
  return problems;
}

function scanRoot(directory){
  const root=path.resolve(directory);
  if(fs.lstatSync(root).isSymbolicLink()||!fs.statSync(root).isDirectory())
    throw new Error('BLOCK: mobile source root must be an ordinary directory');
  const bad=[],files=[];
  const walk=(folder,relative,depth)=>{
    if(depth>32)throw new Error('BLOCK: mobile source nesting exceeds limit');
    const items=fs.readdirSync(folder,{withFileTypes:true});
    if(items.length>20000)throw new Error('BLOCK: too many source directory entries');
    for(const item of items){
      const rel=relative?relative+'/'+item.name:item.name;
      if(excluded(rel))continue;
      const absolute=path.join(folder,item.name);
      // Reject links in production source even when their extension isn't a script.
      if(item.isSymbolicLink())throw new Error('BLOCK: linked mobile source path: '+rel);
      if(item.isDirectory()){walk(absolute,rel,depth+1);continue;}
      if(!item.isFile())throw new Error('BLOCK: unusual mobile source entry: '+rel);
      if(!SCRIPT_EXT.test(item.name))continue;
      if(files.length>=MAX_FILES)throw new Error('BLOCK: mobile source file count exceeds limit');
      const stat=fs.statSync(absolute);
      if(!stat.isFile()||stat.size>MAX_FILE_SIZE)
        throw new Error('BLOCK: oversized/nonregular mobile source: '+rel);
      const content=fs.readFileSync(absolute,'utf8');
      if(content.includes('\uFFFD'))throw new Error('BLOCK: malformed UTF-8 mobile source: '+rel);
      files.push(rel);
      bad.push(...inspectSource(content,rel));
    }
  };
  walk(root,'',0);
  if(files.length<10||!files.includes('App.tsx')||
      !files.some(x=>x.endsWith('/android/src/main/java/com/negresco/finance/security/NegrescoFinanceSecurityV1Module.kt')))
    throw new Error('BLOCK: app entrypoint or native release source missing from OTA audit');
  return {files:files.sort(),violations:bad.sort()};
}

function main(args){
  if(args.length!==1){
    console.error('Usage: node tooling/android/verify_no_ota_runtime_override.cjs apps/mobile');
    return 2;
  }
  try{
    const report=scanRoot(args[0]);
    if(report.violations.length){
      for(const problem of report.violations)console.error('BLOCK: '+problem);
      return 1;
    }
    console.log('PASS: '+report.files.length+' production JS/TS/Kotlin/Java sources contain no known OTA override access');
    return 0;
  }catch(error){
    console.error(error.message);
    return 1;
  }
}
if(require.main===module)process.exitCode=main(process.argv.slice(2));
module.exports={BLOCKED,excluded,inspectSource,scanRoot,main};
