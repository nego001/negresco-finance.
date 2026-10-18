export const DEFAULT_PREFERENCES=Object.freeze({theme:'oled-blue',density:'comfortable',reduceMotion:false,largeText:false,identity:'feminine'});
const themes=new Set(['oled-blue','oled-violet']);
const densities=new Set(['comfortable','compact']);
const identities=new Set(['feminine','masculine','neutral']);
export function normalizePreferences(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {...DEFAULT_PREFERENCES};
  return {
    theme:themes.has(input.theme)?input.theme:DEFAULT_PREFERENCES.theme,
    density:densities.has(input.density)?input.density:DEFAULT_PREFERENCES.density,
    reduceMotion:typeof input.reduceMotion==='boolean'?input.reduceMotion:false,
    largeText:typeof input.largeText==='boolean'?input.largeText:false,
    identity:identities.has(input.identity)?input.identity:DEFAULT_PREFERENCES.identity
  };
}
