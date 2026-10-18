export type HistoryEntry={id:string;date:string;kind:string;valid:boolean;digits:number};
const KEY='guardiao_history_v1';
// Keep the payload small for Android secure storage. Only minimal metadata is retained.
export const MAX_HISTORY_ENTRIES=12;
export function sanitizeHistory(raw:string|null):HistoryEntry[]{
 try{
  const rows:unknown=JSON.parse(raw||'[]');
  if(!Array.isArray(rows))return [];
  return rows.filter((r):r is HistoryEntry=>!!r&&typeof r==='object'&&typeof r.id==='string'&&typeof r.date==='string'&&typeof r.kind==='string'&&typeof r.valid==='boolean'&&Number.isInteger(r.digits)&&r.digits>=0&&r.digits<=80).slice(0,MAX_HISTORY_ENTRIES).map(r=>({id:r.id.slice(0,50),date:r.date.slice(0,60),kind:r.kind.slice(0,60),valid:r.valid,digits:r.digits}));
 }catch{return [];}
}
type SecureStoreApi={getItemAsync:(key:string)=>Promise<string|null>;setItemAsync:(key:string,value:string)=>Promise<void>;deleteItemAsync:(key:string)=>Promise<void>};
export async function loadHistory(store:SecureStoreApi){return sanitizeHistory(await store.getItemAsync(KEY));}
export async function storeHistory(entries:HistoryEntry[],store:SecureStoreApi){await store.setItemAsync(KEY,JSON.stringify(sanitizeHistory(JSON.stringify(entries))));}
export async function eraseHistory(store:SecureStoreApi){await store.deleteItemAsync(KEY);}

/** Serialize SecureStore writes so a slow save cannot restore a cleared history. */
export function createHistoryWriteQueue(store:SecureStoreApi){
 let tail:Promise<void>=Promise.resolve();
 const enqueue=(operation:()=>Promise<void>):Promise<void>=>{
  const pending=tail.then(operation);
  // A failed operation must not block later saves or deletions.
  tail=pending.catch(()=>{});
  return pending;
 };
 return {
  save:(entries:HistoryEntry[])=>enqueue(()=>storeHistory(entries,store)),
  clear:()=>enqueue(()=>eraseHistory(store)),
 };
}
