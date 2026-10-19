import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
 LOCAL_LOCK_PREF_KEY,parseLocalLockPreference,isStrongBiometryAvailable,
 canFinishAuthentication,shouldCoverAndLockOnState,shouldInvalidateLocalSession,type LocalLockStatus
} from './localLockPolicy';

/**
 * Optional biometric UI gate for the preview APK.
 * It does not bind encryption keys, encrypt the database, prevent screenshots,
 * or provide an authenticated backend session.
 */
export function useLocalAppLock(){
 const [status,setStatus]=useState<LocalLockStatus>('loading');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const active=useRef(true);
 const epoch=useRef(0);
 const authenticating=useRef(false);
 const protectedNativePrompt=useRef(false);
 const appState=useRef(AppState.currentState||'active');

 const load=useCallback(async()=>{
  // Each load has its own epoch: retries supersede previous pending reads.
  const attemptEpoch=++epoch.current;
  setStatus('loading');
  setMessage('');
  try{
   const saved=await AsyncStorage.getItem(LOCAL_LOCK_PREF_KEY);
   const enabled=parseLocalLockPreference(saved);
   if(active.current){
    // A preference read started before backgrounding or a manual lock is stale.
    // Fail closed instead of allowing an old null preference to set UI to off.
    if(attemptEpoch!==epoch.current)return;
    if(appState.current!=='active'){
     setStatus('error');
     setMessage('Não foi possível confirmar a proteção com o aplicativo em segundo plano. Verifique novamente.');
     return;
    }
    setStatus(enabled?'locked':'off');
   }
  }catch{
   // An old failed read must not overwrite a newer successful retry.
   if(active.current&&attemptEpoch===epoch.current){
    setStatus('error');
    setMessage('Não foi possível ler a proteção local. O acesso permanecerá bloqueado até a verificação funcionar.');
   }
  }
 },[]);

 useEffect(()=>{
  active.current=true;
  void load();
  const sub=AppState.addEventListener('change',next=>{
   appState.current=next;
   if(shouldCoverAndLockOnState(next)){
    // Ignore only transient inactive states caused by an intentional native
    // biometric prompt; background ALWAYS revokes the UI session.
    if(shouldInvalidateLocalSession(next,authenticating.current||protectedNativePrompt.current)){
     epoch.current++;
     setStatus(prev=>prev==='unlocked'?'locked':prev);
    }
   }
  });
  return()=>{
   active.current=false;
   epoch.current++;
   sub.remove();
  };
 },[load]);

 const verifyStrong=useCallback(async(promptMessage:string):Promise<boolean>=>{
  if(authenticating.current)return false;
  authenticating.current=true;
  setBusy(true);
  setMessage('');
  const ticket=epoch.current;
  try{
   const [hardware,enrolled,level]=await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.getEnrolledLevelAsync()
   ]);
   if(!isStrongBiometryAvailable(hardware,enrolled,level)){
    if(active.current)setMessage('Cadastre uma biometria forte, como uma impressão digital, nas configurações do Android para ativar essa proteção.');
    return false;
   }
   if(!canFinishAuthentication(true,ticket,epoch.current,appState.current))return false;
   const result=await LocalAuthentication.authenticateAsync({
    promptMessage,
    promptSubtitle:'Negresco Finance · proteção da prévia',
    biometricsSecurityLevel:'strong',
    disableDeviceFallback:true,
    requireConfirmation:true
   });
   if(!canFinishAuthentication(result.success,ticket,epoch.current,appState.current)){
    if(active.current)setMessage(result.success?'O app mudou de estado. Autentique novamente.':'Autenticação não concluída. O aplicativo continua protegido.');
    return false;
   }
   return true;
  }catch{
   if(active.current)setMessage('Não foi possível confirmar a biometria neste dispositivo.');
   return false;
  }finally{
   authenticating.current=false;
   if(active.current)setBusy(false);
  }
 },[]);

 const unlock=useCallback(async()=>{
  if(status!=='locked')return;
  const ticket=epoch.current;
  if(await verifyStrong('Desbloquear Negresco Finance')&&active.current&&
     canFinishAuthentication(true,ticket,epoch.current,appState.current))setStatus('unlocked');
 },[status,verifyStrong]);

 const enable=useCallback(async()=>{
  if(status!=='off')return;
  if(!await verifyStrong('Ativar bloqueio biométrico'))return;
  const ticket=epoch.current;
  try{
   await AsyncStorage.setItem(LOCAL_LOCK_PREF_KEY,'enabled');
   if(active.current)setStatus(canFinishAuthentication(true,ticket,epoch.current,appState.current)?'unlocked':'locked');
  }catch{
   if(active.current){setStatus('error');setMessage('O estado do bloqueio não pôde ser confirmado. Acesse novamente as preferências somente após recuperar o armazenamento.');}
  }
 },[status,verifyStrong]);

 const disable=useCallback(async()=>{
  if(status!=='unlocked')return;
  const ticket=epoch.current;
  if(!await verifyStrong('Desativar bloqueio biométrico'))return;
  if(!canFinishAuthentication(true,ticket,epoch.current,appState.current))return;
  try{
   await AsyncStorage.removeItem(LOCAL_LOCK_PREF_KEY);
   // Do not reopen UI after a background transition during storage I/O.
   if(active.current&&canFinishAuthentication(true,ticket,epoch.current,appState.current))setStatus('off');
   else if(active.current)setStatus('error');
  }catch{
   if(active.current)setMessage('Falha ao desativar a proteção. O bloqueio permanece habilitado.');
  }
 },[status,verifyStrong]);

 /**
  * Prevent a trusted manual SecureStore diagnostic from being mistaken for
  * the user leaving the app. Does not confer any native key authorization.
  */
 const withProtectedNativePrompt=useCallback(async <T,>(task:()=>Promise<T>):Promise<T>=>{
  if(!active.current||protectedNativePrompt.current||authenticating.current||appState.current!=='active')
   throw new Error('Native prompt is unavailable');
  protectedNativePrompt.current=true;
  try{return await task();}
  finally{protectedNativePrompt.current=false;}
 },[]);

 const lockNow=useCallback(()=>{
  epoch.current++;
  setMessage('');
  setStatus(prev=>prev==='unlocked'?'locked':prev);
 },[]);

 return {
  status,busy,message,unlock,enable,disable,lockNow,retry:load,withProtectedNativePrompt,
  enabled:status==='locked'||status==='unlocked'
 };
}
