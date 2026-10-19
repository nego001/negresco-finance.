/** Minimal lifecycle policy for temporary on-screen data. Not an authentication barrier. */
export function shouldClearSensitiveOnNavigation(from:string,to:string):boolean{
 return from!==to&&(from==='Guardião'||from==='Negresco');
}
export function shouldClearSensitiveOnAppState(nextState:string):boolean{
 return nextState==='background'||nextState==='inactive';
}
