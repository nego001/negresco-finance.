/**
 * Android Expo Print SDK 54 generates cache/Print/<UUID>.pdf.
 * This allowlist prevents deleting a different cache file or any document.
 * No directory traversal, URI decoding, wildcard, or recursive deletion.
 */
const UUID_PDF=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

export function isOwnedPrintPdfUri(uri:unknown,cacheDirectory:unknown):uri is string{
  if(typeof uri!=='string'||typeof cacheDirectory!=='string')return false;
  if(!cacheDirectory.startsWith('file:///')||!cacheDirectory.endsWith('/'))return false;
  if(cacheDirectory.includes('%')||cacheDirectory.includes('?')||cacheDirectory.includes('#'))return false;
  const prefix=cacheDirectory+'Print/';
  if(!uri.startsWith(prefix))return false;
  return UUID_PDF.test(uri.slice(prefix.length));
}

/**
 * Cleanup is best-effort: a printer failure may leave an unknown path behind.
 * A URI must be exactly one app-cache PDF before any filesystem delete call.
 */
export async function discardUnsharedPrintPdf(
  uri:unknown,
  cacheDirectory:unknown,
  deleteFile:(uri:string)=>Promise<void>
):Promise<boolean>{
  if(!isOwnedPrintPdfUri(uri,cacheDirectory))return false;
  try{
    await deleteFile(uri);
    return true;
  }catch{
    return false;
  }
}
