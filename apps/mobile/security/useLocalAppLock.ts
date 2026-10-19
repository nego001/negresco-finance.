import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
 LOCAL_LOCK_PREF_KEY,parseLocalLockPreference,isStrongBiometryAvailable,
 canFinishAuthentication,shouldCoverAndLockOnState,type LocalLockStatus
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
 const appState=useRef(AppState.currentState||'active');

 const load=useCallback(async()=>{
  setStatus('loading');
  setMessage('');
  const attemptEpoch=epoch.current;
  try{
   const saved=await AsyncStorage.getItem(LOCAL_LOCK_PREF_KEY);
   const enabled=parseLocalLockPreference(saved);
   if(active.current){
    // An old storage read must not reopen a session after backgrounding.
    setStatus(enabled?'locked':'off');
    if(attemptEpoch!==epoch.current&&enabled)setStatus('locked');
   }
  }catch{
   if(active.current){setStatus('error');setMessage('Não foi possível ler a proteção local. O acesso permanecerá bloqueado até a verificação funcionar.');}
  }
 },[]);

 useEffect(()=>{
  active.current=true;
  void load();
  const sub=AppState.addEventListener('change',next=>{
   appState.current=next;
   if(shouldCoverAndLockOnState(next)){
    // Android's own biometric prompt may generate an inactive transition.
    // Treat background as a hard invalidation even while prompting.
    if(next==='background'||!authenticating.current)epoch.current++;
    setStatus(prev=>prev==='unlocked'?'locked':prev);
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
  if(await verifyStrong('Desbloquear Negresco Finance')&&active.current)setStatus('unlocked');
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
  if(!await verifyStrong('Desativar bloqueio biométrico'))return;
  if(appState.current!=='active')return;
  try{
   await AsyncStorage.removeItem(LOCAL_LOCK_PREF_KEY);
   if(active.current)setStatus('off');
  }catch{
   if(active.current)setMessage('Falha ao desativar a proteção. O bloqueio permanece habilitado.');
  }
 },[status,verifyStrong]);

 const lockNow=useCallback(()=>{
  epoch.current++;
  setMessage('');
  setStatus(prev=>prev==='unlocked'?'locked':prev);
 },[]);

 return {
  status,busy,message,unlock,enable,disable,lockNow,retry:load,
  enabled:status==='locked'||status==='unlocked'
 };
}
