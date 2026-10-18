import * as SecureStore from 'expo-secure-store';
export type HistoryEntry={id:string;date:string;kind:string;valid:boolean;digits:number};
const KEY='guardiao_history_v1';
export function sanitizeHistory(raw:string|null):HistoryEntry[]{
 try{
  const rows:unknown=JSON.parse(raw||'[]');
  if(!Array.isArray(rows))return [];
  return rows.filter((r):r is HistoryEntry=>!!r&&typeof r==='object'&&typeof r.id==='string'&&typeof r.date==='string'&&typeof r.kind==='string'&&typeof r.valid==='boolean'&&(r.digits===47||r.digits===48)).slice(0,30).map(r=>({id:r.id.slice(0,50),date:r.date.slice(0,60),kind:r.kind.slice(0,60),valid:r.valid,digits:r.digits}));
 }catch{return [];}
}
export async function loadHistory(){return sanitizeHistory(await SecureStore.getItemAsync(KEY));}
export async function storeHistory(entries:HistoryEntry[]){await SecureStore.setItemAsync(KEY,JSON.stringify(sanitizeHistory(JSON.stringify(entries))));}
export async function eraseHistory(){await SecureStore.deleteItemAsync(KEY);}
