/**
 * One outstanding Guardião PDF export per live app instance.
 *
 * React state alone is not an atomic re-entry gate: rapid taps may dispatch
 * two native print operations before the next render. A cancelled navigation
 * token does not cancel a pending Android Print/Sharing promise.
 *
 * Never release on a JS timeout. Release only in the caller's finally after
 * the actual native pipeline settles, including a rejected promise.
 * This reduces overlapping native operations; it does NOT fix a native hang.
 */
export function createPdfNativeExportGate():{
  acquire:()=>null|(()=>void);
  busy:()=>boolean;
}{
  let held=false;
  return {
    acquire:()=>{
      if(held)return null;
      held=true;
      let released=false;
      return ()=>{
        if(released)return;
        released=true;
        held=false;
      };
    },
    busy:()=>held
  };
}
