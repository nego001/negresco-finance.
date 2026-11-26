import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySyntheticGlob} from '../tooling/android/guardiao_portable_glob_paths_m142.mjs';
test('M142 R2 recognizes native Windows separator without changing POSIX semantics',()=>{verifySyntheticGlob(['assets\\sample.txt'],'win32');verifySyntheticGlob(['assets/sample.txt'],'win32');verifySyntheticGlob(['assets/sample.txt'],'linux');assert.throws(()=>verifySyntheticGlob(['assets\\sample.txt'],'linux'))});
test('M142 R2 rejects absolute, traversal, wrong, missing and extra glob results on both platforms',()=>{for(const platform of ['win32','linux'])for(const paths of [[],['assets/sample.txt','assets/sample.txt'],['assets/other.bin'],['/assets/sample.txt'],['C:\\assets\\sample.txt'],['assets/../assets/sample.txt'],['./assets/sample.txt'],[null]])assert.throws(()=>verifySyntheticGlob(paths,platform))});
