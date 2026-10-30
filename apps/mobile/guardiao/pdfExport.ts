/**
 * Guardião PDF export is an explicit, foreground-only user action.
 * This module deliberately does not retain report HTML, sensitive input or URIs.
 * It cannot revoke a share sheet after the native sharing call has begun.
 */
export type PdfExportOutcome='shared'|'unavailable'|'cancelled'|'failed';
// Fixed, non-sensitive phase codes only. Never reveal native exception text or local URI.
export type PdfExportFailurePhase='print'|'invalid-uri'|'availability'|'share';
// Informational only. Called immediately before awaiting a native operation;
// it never receives HTML, URIs, native errors, inputs, or personal data.
export type PdfExportPendingPhase='print'|'availability'|'share';

export type PdfExportPorts={
  html:string;
  print:(html:string)=>Promise<{uri:string}>;
  sharingAvailable:()=>Promise<boolean>;
  share:(uri:string)=>Promise<unknown>;
  isCurrent:()=>boolean;
  // Called for a generated file only if native sharing was never invoked.
  discardUnsharedFile?:(uri:string)=>Promise<boolean>;
  onFailurePhase?:(phase:PdfExportFailurePhase)=>void;
  onPendingPhase?:(phase:PdfExportPendingPhase)=>void;
};

export async function exportPdfWithLifecycleGuard(ports:PdfExportPorts):Promise<PdfExportOutcome>{
  const authorized=():boolean=>{
    try{return ports.isCurrent()===true;}catch{return false;}
  };
  if(!authorized())return 'cancelled';
  let createdUri:string|null=null;
  let nativeShareStarted=false;
  let phase:PdfExportFailurePhase='print';
  const reportFailure=()=>{try{ports.onFailurePhase?.(phase);}catch{/* never expose error text */}};
  const reportPending=(stage:PdfExportPendingPhase):boolean=>{
    if(!authorized())return false;
    try{ports.onPendingPhase?.(stage);}catch{/* observer errors are contained */}
    // The observer is untrusted and can synchronously revoke the foreground
    // token, e.g. by changing a screen or triggering a biometric lock.
    // Never start a native operation after that revocation.
    return authorized();
  };
  try{
    if(!reportPending('print'))return 'cancelled';
    const pdf=await ports.print(ports.html);
    createdUri=typeof pdf?.uri==='string'?pdf.uri:null;
    if(!authorized())return 'cancelled';
    if(!createdUri||!createdUri.startsWith('file://')||
       !/\.pdf(?:[?#]|$)/i.test(createdUri)){
      phase='invalid-uri';
      reportFailure();
      return 'failed';
    }
    phase='availability';
    if(!reportPending('availability'))return 'cancelled';
    const available=await ports.sharingAvailable();
    if(!authorized())return 'cancelled';
    if(!available)return 'unavailable';
    if(!authorized())return 'cancelled';
    // After this point the native chooser may still be using the file.
    phase='share';
    if(!reportPending('share'))return 'cancelled';
    nativeShareStarted=true;
    await ports.share(createdUri);
    return authorized()?'shared':'cancelled';
  }catch{
    if(!authorized())return 'cancelled';
    reportFailure();
    return 'failed';
  }finally{
    // Explicitly never delete while a native chooser may be reading the file.
    // The optional callback itself must validate ownership and cache path.
    if(!nativeShareStarted&&createdUri&&ports.discardUnsharedFile){
      try{await ports.discardUnsharedFile(createdUri);}catch{/* best-effort only */}
    }
  }
}
