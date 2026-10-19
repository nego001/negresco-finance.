import {isStrongBiometryAvailable} from './localLockPolicy';

/**
 * Android-only non-sensitive SecureStore / Android Keystore smoke test.
 * This cannot certify hardware-backed keys, SQLCipher, E2EE or zero-knowledge.
 * It stores ONLY a synthetic fixed marker, never financial information or keys.
 */
export const KEYSTORE_PROBE_KEY='negresco.keystore.probe.v1';
export const KEYSTORE_PROBE_SERVICE='negresco.keystore.probe.authenticated.v1';
const SYNTHETIC_MARKER='NEGRESCO_PROBE_V1_SYNTHETIC_NOT_A_SECRET';
type Options={requireAuthentication?:boolean;keychainService?:string;authenticationPrompt?:string};
export type SecureStoreProbeAdapter={
 isAvailableAsync:()=>Promise<boolean>;
 getItemAsync:(key:string,options?:Options)=>Promise<string|null>;
 setItemAsync:(key:string,value:string,options?:Options)=>Promise<void>;
 deleteItemAsync:(key:string,options?:Options)=>Promise<void>;
};
export type BiometricsProbeAdapter={
 hasHardwareAsync:()=>Promise<boolean>;
 isEnrolledAsync:()=>Promise<boolean>;
 getEnrolledLevelAsync:()=>Promise<number>;
};
export type KeystoreProbeResult={
 status:'passed'|'failed'|'unavailable';
 message:string;
};
const guardedOptions:Options={
 requireAuthentication:true,
 keychainService:KEYSTORE_PROBE_SERVICE,
 authenticationPrompt:'Confirmar proteção local de teste do Negresco Finance'
};
const removalOptions:Options={keychainService:KEYSTORE_PROBE_SERVICE};

export async function runKeystoreProbe(
 store:SecureStoreProbeAdapter,auth:BiometricsProbeAdapter,platform:string
):Promise<KeystoreProbeResult>{
 if(platform!=='android')return {
  status:'unavailable',
  message:'Este teste experimental está disponível apenas em Android.'
 };
 try{
  const [available,hardware,enrolled,level]=await Promise.all([
   store.isAvailableAsync(),auth.hasHardwareAsync(),auth.isEnrolledAsync(),auth.getEnrolledLevelAsync()
  ]);
  if(!available||!isStrongBiometryAvailable(hardware,enrolled,level))return {
   status:'unavailable',
   message:'SecureStore ou biometria forte indisponível. Nenhum teste foi gravado.'
  };
 }catch{
  return {status:'unavailable',message:'Não foi possível verificar a disponibilidade da proteção local.'};
 }
 let outcome:'passed'|'failed'='failed';
 let touched=false;
 let cleanupOk=true;
 try{
  touched=true;
  await store.setItemAsync(KEYSTORE_PROBE_KEY,SYNTHETIC_MARKER,guardedOptions);
  const restored=await store.getItemAsync(KEYSTORE_PROBE_KEY,guardedOptions);
  outcome=restored===SYNTHETIC_MARKER?'passed':'failed';
 }catch{
  outcome='failed';
 }finally{
  if(touched){
   try{
    await store.deleteItemAsync(KEYSTORE_PROBE_KEY,removalOptions);
   }catch{
    cleanupOk=false;
   }
  }
 }
 if(!cleanupOk)return {
  status:'failed',
  message:'O teste não conseguiu apagar o marcador fictício. Não interpretar o resultado como aprovado.'
 };
 if(outcome!=='passed')return {
  status:'failed',
  message:'A gravação ou leitura autenticada falhou ou foi cancelada. Nenhuma chave real foi criada.'
 };
 return {
  status:'passed',
  message:'Marcador fictício gravado, lido com autenticação requerida e apagado. Isso NÃO certifica hardware dedicado, SQLCipher ou zero-knowledge.'
 };
}
