import React from 'react';
import {ActivityIndicator,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import type {LocalLockStatus} from '../security/localLockPolicy';

export function LocalLockScreen({status,busy,message,onUnlock,onRetry}:{
 status:LocalLockStatus;
 busy:boolean;
 message:string;
 onUnlock:()=>void;
 onRetry:()=>void;
}){
 const isLoading=status==='loading';
 const isError=status==='error';
 return <View style={styles.container}>
  <View style={styles.emblem}><Text style={styles.monogram}>N</Text></View>
  <Text style={styles.eyebrow}>NEGRESCO FINANCE</Text>
  <Text style={styles.heading}>{isLoading?'Preparando proteção':isError?'Proteção indisponível':'Acesso protegido'}</Text>
  <Text style={styles.description}>{isLoading?'Conferindo suas preferências locais.':isError?'Não foi possível verificar se o bloqueio estava habilitado.':'Use sua biometria forte cadastrada no Android para abrir a prévia.'}</Text>
  {isLoading?<ActivityIndicator color="#78B5FF" size="large"/>:
   <TouchableOpacity accessibilityRole="button"
    accessibilityLabel={isError?'Tentar verificar proteção novamente':'Desbloquear aplicativo com biometria'}
    disabled={busy}
    onPress={isError?onRetry:onUnlock}
    style={[styles.button,busy&&styles.busy]}>
     <Text style={styles.buttonText}>{busy?'Verificando...':isError?'Tentar novamente':'Desbloquear com biometria'}</Text>
   </TouchableOpacity>}
  {!!message&&<Text style={styles.feedback}>{message}</Text>}
  <Text style={styles.footer}>Bloqueio da interface em teste. Ainda não protege as chaves do SQLCipher, não impede capturas de tela e não substitui autenticação bancária.</Text>
 </View>;
}
const styles=StyleSheet.create({
 container:{flex:1,backgroundColor:'#000000',alignItems:'center',justifyContent:'center',paddingHorizontal:30},
 emblem:{width:88,height:88,borderRadius:30,borderWidth:1,borderColor:'#4E80B7',backgroundColor:'#12243A',alignItems:'center',justifyContent:'center',marginBottom:25},
 monogram:{color:'#A4D0FF',fontSize:45,fontWeight:'900'},
 eyebrow:{color:'#83B9F7',letterSpacing:2,fontSize:10,fontWeight:'800',marginBottom:13},
 heading:{color:'#F7FAFF',fontSize:24,fontWeight:'900',textAlign:'center'},
 description:{color:'#AABCD0',fontSize:13,textAlign:'center',lineHeight:21,marginTop:15,marginBottom:24},
 button:{backgroundColor:'#78B5FF',paddingHorizontal:25,paddingVertical:15,borderRadius:15,minWidth:230,alignItems:'center'},
 busy:{opacity:.55},
 buttonText:{color:'#051526',fontSize:14,fontWeight:'900'},
 feedback:{color:'#F1CE99',textAlign:'center',fontSize:12,lineHeight:20,marginTop:20},
 footer:{color:'#7890AA',fontSize:11,lineHeight:18,textAlign:'center',marginTop:35}
});
