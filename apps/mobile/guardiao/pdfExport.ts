/**
 * Guardião PDF export is an explicit, foreground-only user action.
 * This module deliberately does not retain report HTML, sensitive input or URIs.
 * It cannot revoke a share sheet after the native sharing call has begun.
 */
export type PdfExportOutcome='shared'|'unavailable'|'cancelled'|'failed';

export type PdfExportPorts={
  html:string;
  print:(html:string)=>Promise<{uri:string}>;
  sharingAvailable:()=>Promise<boolean>;
  share:(uri:string)=>Promise<unknown>;
  isCurrent:()=>boolean;
  // Called for a generated file only if native sharing was never invoked.
  discardUnsharedFile?:(uri:string)=>Promise<boolean>;
};

export async function exportPdfWithLifecycleGuard(ports:PdfExportPorts):Promise<PdfExportOutcome>{
  const authorized=():boolean=>{
    try{return ports.isCurrent()===true;}catch{return false;}
  };
  if(!authorized())return 'cancelled';
  let createdUri:string|null=null;
  let nativeShareStarted=false;
  try{
    const pdf=await ports.print(ports.html);
    createdUri=typeof pdf?.uri==='string'?pdf.uri:null;
    if(!authorized())return 'cancelled';
    if(!createdUri||!createdUri.startsWith('file://')||
       !/\.pdf(?:[?#]|$)/i.test(createdUri))return 'failed';
    const available=await ports.sharingAvailable();
    if(!authorized())return 'cancelled';
    if(!available)return 'unavailable';
    if(!authorized())return 'cancelled';
    // After this point the native chooser may still be using the file.
    nativeShareStarted=true;
    await ports.share(createdUri);
    return authorized()?'shared':'cancelled';
  }catch{
    return authorized()?'failed':'cancelled';
  }finally{
    // Explicitly never delete while a native chooser may be reading the file.
    // The optional callback itself must validate ownership and cache path.
    if(!nativeShareStarted&&createdUri&&ports.discardUnsharedFile){
      try{await ports.discardUnsharedFile(createdUri);}catch{/* best-effort only */}
    }
  }
}
