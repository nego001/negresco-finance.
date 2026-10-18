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
