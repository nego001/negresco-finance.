/** Ephemeral draft deduplication, not a distributed payment idempotency store. */
export function createDraftRegistry({maxEntries=1000}={}){
  if(!Number.isSafeInteger(maxEntries)||maxEntries<1)throw new TypeError('Invalid registry capacity');
  const entries=new Map();
  return Object.freeze({
    register({userId,key,fingerprint}){
      if(![userId,key,fingerprint].every(v=>typeof v==='string'&&v.length>=1&&v.length<=256))return {accepted:false,reason:'INVALID_IDEMPOTENCY'};
      const composite=JSON.stringify([userId,key]);
      const previous=entries.get(composite);
      if(previous)return {accepted:previous===fingerprint,reason:previous===fingerprint?'DUPLICATE_DRAFT':'IDEMPOTENCY_CONFLICT'};
      if(entries.size>=maxEntries)return {accepted:false,reason:'REGISTRY_FULL'};
      entries.set(composite,fingerprint);
      return {accepted:true,reason:'NEW_DRAFT'};
    },
    size(){return entries.size;}
  });
}
