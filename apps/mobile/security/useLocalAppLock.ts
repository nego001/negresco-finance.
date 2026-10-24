import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
 LOCAL_LOCK_PREF_KEY,LOCAL_LOCK_OPTOUT_JOURNAL_KEY,parseLocalLockWithJournal,isStrongBiometryAvailable,
 canFinishAuthentication,shouldCoverAndLockOnState,shouldInvalidateLocalSession,
 persistBiometricOptOut,type LocalLockStatus
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
 const preferenceMutation=useRef(false);
 const pendingReadEpoch=useRef<number|null>(null);
 const reloadOnForeground=useRef(false);
 const appState=useRef(AppState.currentState||'active');

 const load=useCallback(async()=>{
  if(preferenceMutation.current)return;
  // Each load has its own epoch: retries supersede previous pending reads.
  const attemptEpoch=++epoch.current;
  pendingReadEpoch.current=attemptEpoch;
  setStatus('loading');
  setMessage('');
  try{
   const [saved,journal]=await Promise.all([
    AsyncStorage.getItem(LOCAL_LOCK_PREF_KEY),
    AsyncStorage.getItem(LOCAL_LOCK_OPTOUT_JOURNAL_KEY)
   ]);
   const enabled=parseLocalLockWithJournal(saved,journal);
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
  }finally{
   if(pendingReadEpoch.current===attemptEpoch)pendingReadEpoch.current=null;
  }
 },[]);

 useEffect(()=>{
  active.current=true;
  void load();
  const sub=AppState.addEventListener('change',next=>{
   appState.current=next;
   // A preference read invalidated by background needs a fresh read on return.
   // Otherwise loading could remain stuck without a retry button.
   if(next==='active'&&reloadOnForeground.current){
    reloadOnForeground.current=false;
    void load();
   }
   if(shouldCoverAndLockOnState(next)){
    // Ignore only transient inactive states caused by an intentional native
    // biometric prompt; background ALWAYS revokes the UI session.
    if(shouldInvalidateLocalSession(next,authenticating.current||protectedNativePrompt.current)){
     if(pendingReadEpoch.current!==null)reloadOnForeground.current=true;
     epoch.current++;
     setStatus(prev=>prev==='unlocked'?'locked':prev);
    }
   }
  });
  return()=>{
   active.current=false;
   reloadOnForeground.current=false;
   epoch.current++;
   sub.remove();
  };
 },[load]);

 const verifyStrong=useCallback(async(promptMessage:string):Promise<boolean>=>{
  if(authenticating.current||protectedNativePrompt.current||preferenceMutation.current||!active.current||appState.current!=='active')return false;
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
  if(preferenceMutation.current)return;
  preferenceMutation.current=true;
  const ticket=epoch.current;
  try{
   await AsyncStorage.setItem(LOCAL_LOCK_PREF_KEY,'enabled');
   if(active.current)setStatus(canFinishAuthentication(true,ticket,epoch.current,appState.current)?'unlocked':'locked');
  }catch{
   if(active.current){setStatus('error');setMessage('O estado do bloqueio não pôde ser confirmado. Acesse novamente as preferências somente após recuperar o armazenamento.');}
  }finally{
   preferenceMutation.current=false;
  }
 },[status,verifyStrong]);

 const disable=useCallback(async()=>{
  if(status!=='unlocked')return;
  const ticket=epoch.current;
  if(!await verifyStrong('Desativar bloqueio biométrico'))return;
  if(!canFinishAuthentication(true,ticket,epoch.current,appState.current)||preferenceMutation.current)return;
  preferenceMutation.current=true;
  try{
  const valid=()=>active.current&&canFinishAuthentication(true,ticket,epoch.current,appState.current);
  const outcome=await persistBiometricOptOut(AsyncStorage,valid);
  if(!active.current)return;
  if(outcome==='disabled'&&valid()){
   setStatus('off');
  }else if(outcome==='failed'){
   setStatus('error');
   setMessage('O estado salvo da proteção não pôde ser confirmado. O acesso foi bloqueado; tente verificar novamente.');
  }else{
   setStatus('locked');
   setMessage('A desativação foi interrompida. Confirme a biometria novamente antes de desativar.');
  }
  }finally{
   preferenceMutation.current=false;
  }
 },[status,verifyStrong]);

 /**
  * Prevent a trusted manual SecureStore diagnostic from being mistaken for
  * the user leaving the app. Does not confer any native key authorization.
  */
 const withProtectedNativePrompt=useCallback(async <T,>(task:()=>Promise<T>):Promise<T>=>{
  if(!active.current||protectedNativePrompt.current||authenticating.current||preferenceMutation.current||appState.current!=='active')
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
