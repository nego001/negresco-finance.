/**
 * LAB ONLY: Compare the real report renderer with a small, fixed synthetic
 * HTML input after a failure. Never expose source HTML, exception, file URI,
 * banking details or the temporary PDF in logs or user-facing messages.
 *
 * This is diagnostic information, NOT a PDF generation fallback.
 */
export type MinimalPrintProbe='minimal-output-created'|'minimal-output-unverified'|'minimal-print-failed';

const FIXED_HTML='<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><p>TESTE LOCAL SINTETICO DE PDF</p></body></html>';

export async function probeMinimalPrintEngine(ports:{
  print:(html:string)=>Promise<{uri:string}>;
  inspectOwnedPdf:(uri:string)=>Promise<boolean>;
  discardOwnedPdf:(uri:string)=>Promise<boolean>;
}):Promise<MinimalPrintProbe>{
  let uri:string|null=null;
  let outcome:MinimalPrintProbe='minimal-print-failed';
  try{
    const result=await ports.print(FIXED_HTML);
    uri=typeof result?.uri==='string'?result.uri:null;
    if(uri){
      let verified=false;
      try{verified=await ports.inspectOwnedPdf(uri)===true;}catch{verified=false;}
      outcome=verified?'minimal-output-created':'minimal-output-unverified';
    }else{
      outcome='minimal-output-unverified';
    }
  }catch{/* deliberately do not collect or reveal native exception */}
  finally{
    // Probe output is never shared. Remove it only through strict private
    // Expo Print cache ownership validation (fail-closed, nonrecursive).
    if(uri){try{await ports.discardOwnedPdf(uri);}catch{/* best effort */}}
  }
  return outcome;
}
