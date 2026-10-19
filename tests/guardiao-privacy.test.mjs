import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldClearSensitiveOnNavigation,shouldClearSensitiveOnAppState} from '../apps/mobile/guardiao/privacy.ts';

test('sensitive on-screen fields are cleared when leaving Guardião or Negresco',()=>{
 for(const page of ['Guardião','Negresco']){
  assert.equal(shouldClearSensitiveOnNavigation(page,'Início'),true);
  assert.equal(shouldClearSensitiveOnNavigation(page,'Ajustes'),true);
  assert.equal(shouldClearSensitiveOnNavigation(page,page),false);
 }
 assert.equal(shouldClearSensitiveOnNavigation('Início','Guardião'),false);
});
test('background and inactive states clear ephemeral data; active does not',()=>{
 assert.equal(shouldClearSensitiveOnAppState('background'),true);
 assert.equal(shouldClearSensitiveOnAppState('inactive'),true);
 assert.equal(shouldClearSensitiveOnAppState('active'),false);
});
test('React Native app wires navigation and background guards',()=>{
 const code=readFileSync(new URL('../apps/mobile/App.tsx',import.meta.url),'utf8');
 assert.match(code,/AppState\.addEventListener\('change'/);
 assert.match(code,/shouldClearSensitiveOnAppState\(nextState\)/);
 assert.match(code,/shouldClearSensitiveOnNavigation\(page,p\)/);
 assert.match(code,/clearCurrentAnalysis\(\)/);
 assert.match(code,/clearAssistantPreview\(\)/);
});
