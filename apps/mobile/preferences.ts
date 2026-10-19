export type Preferences={accent:boolean;compact:boolean;fontLarge:boolean;reducedMotion:boolean;assistantStyle:'acolhedora'|'objetiva'};
export const defaultPreferences:Preferences={accent:false,compact:false,fontLarge:false,reducedMotion:false,assistantStyle:'acolhedora'};
export function decodePreferences(raw:string|null):Preferences{
 if(!raw)return {...defaultPreferences};
 try{const p:unknown=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))return {...defaultPreferences};
 const o=p as Record<string,unknown>;return {
 accent:typeof o.accent==='boolean'?o.accent:false,
 compact:typeof o.compact==='boolean'?o.compact:false,
 fontLarge:typeof o.fontLarge==='boolean'?o.fontLarge:false,
 reducedMotion:typeof o.reducedMotion==='boolean'?o.reducedMotion:false,
 assistantStyle:o.assistantStyle==='objetiva'?'objetiva':'acolhedora'
 };}catch{return {...defaultPreferences};}
}
export function encodePreferences(p:Preferences):string{return JSON.stringify(p);}

/** Keep visual-preference writes ordered; a slower older write cannot overwrite a newer one. */
export const PREFERENCES_STORAGE_KEY='negresco.preferences.v1';
type PreferenceStore={setItem:(key:string,value:string)=>Promise<void>};
export function createPreferenceWriteQueue(store:PreferenceStore){
 let tail:Promise<void>=Promise.resolve();
 return {
  save:(preferences:Preferences):Promise<void>=>{
   const payload=encodePreferences(preferences);
   const pending=tail.then(()=>store.setItem(PREFERENCES_STORAGE_KEY,payload));
   tail=pending.catch(()=>{});
   return pending;
  }
 };
}
