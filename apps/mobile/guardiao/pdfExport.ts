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
};

export async function exportPdfWithLifecycleGuard(ports:PdfExportPorts):Promise<PdfExportOutcome>{
  // Treat a throwing, unknown or stale lifecycle check as authorization denied.
  const authorized=():boolean=>{
    try{return ports.isCurrent()===true;}catch{return false;}
  };
  if(!authorized())return 'cancelled';
  try{
    const pdf=await ports.print(ports.html);
    if(!authorized())return 'cancelled';
    // A local PDF is required. Reject remote or otherwise unexpected output URIs.
    if(!pdf||typeof pdf.uri!=='string'||!pdf.uri.startsWith('file://')||
       !/\.pdf(?:[?#]|$)/i.test(pdf.uri))return 'failed';
    const available=await ports.sharingAvailable();
    if(!authorized())return 'cancelled';
    if(!available)return 'unavailable';
    // No await between this final guard and entry into the native share API.
    if(!authorized())return 'cancelled';
    await ports.share(pdf.uri);
    return authorized()?'shared':'cancelled';
  }catch{
    return authorized()?'failed':'cancelled';
  }
}
