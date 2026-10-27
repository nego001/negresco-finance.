import { inspectBoleto } from './guardiao/validator';
import { consultCnpj, type CompanyResult } from './guardiao/company';
import {reclameAqui,bankMonitoring,availabilityMessage} from './guardiao/integrations';
import {loadHistory,createHistoryWriteQueue} from './guardiao/history';
import * as SecureStore from 'expo-secure-store';
import { buildEvidenceReview, type EvidenceReviewState } from './guardiao/evidence';
import { createLocalReport, renderReportHtml } from './guardiao/report';
import {exportPdfWithLifecycleGuard} from './guardiao/pdfExport';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Icon, IconName } from './components/Icon';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodePreferences, createPreferenceWriteQueue, PREFERENCES_STORAGE_KEY } from './preferences';
import { shouldClearSensitiveOnNavigation, shouldClearSensitiveOnAppState } from './guardiao/privacy';
import {useLocalAppLock} from './security/useLocalAppLock';
import {runKeystoreProbe, type KeystoreProbeResult} from './security/keystoreProbe';
import {inspectNativeFinanceReadiness, type NativeFinanceReadiness} from './security/nativeFinanceReadiness';
import {getOptionalNativeFinanceDiagnosticHost} from './modules/negresco-finance-security/src/NegrescoFinanceSecurityV1';
import * as LocalAuthentication from 'expo-local-authentication';
import {LocalLockScreen} from './components/LocalLockScreen';
import {ProtectedScreenCapture,shouldProtectScreenCapture} from './components/ProtectedScreenCapture';
import { Animated, AppState, Easing, SafeAreaView, ScrollView, StatusBar, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Page = 'Início' | 'Pix' | 'Contas' | 'Cartões' | 'Investimentos' | 'Metas' | 'Negresco' | 'Guardião' | 'Ajustes';
const C = { bg:'#000000',panel:'#0D111A',raised:'#121A29',line:'#26354B',blue:'#78B5FF',muted:'#99A8BC',white:'#F7FAFF' };
const evidenceStatusLabels:Record<EvidenceReviewState,string>={
 'local-checked':'Dígitos conferem',
 'local-invalid':'Inconsistente',
 'external-response':'Resposta externa',
 'external-unavailable':'Indisponível',
 'not-checked':'Não consultado'
};
const evidenceStatusColors:Record<EvidenceReviewState,string>={
 'local-checked':'#7AC9AE',
 'local-invalid':'#F5B984',
 'external-response':'#92C5FF',
 'external-unavailable':'#E2BF83',
 'not-checked':'#9DAEC4'
};
const sections: {name:Page;glyph:IconName;description:string}[] = [
  {name:'Contas',glyph:'accounts',description:'Instituições e saldos'},
  {name:'Pix',glyph:'pix',description:'Pagamentos e recebimentos'},
  {name:'Cartões',glyph:'cards',description:'Limites e faturas'},
  {name:'Investimentos',glyph:'invest',description:'Patrimônio e evolução'},
  {name:'Metas',glyph:'goals',description:'Objetivos pessoais'},
  {name:'Negresco',glyph:'assistant',description:'Sua assistente financeira'},
  {name:'Guardião',glyph:'eye',description:'Investigação de boletos'}
];
function Tap({title,subtitle,glyph,onPress,style}:{title:string;subtitle?:string;glyph:IconName;onPress:()=>void;style?:object}) {
  return <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={title} activeOpacity={0.72} style={[s.tile,style]}>
    <View style={s.tileGlyph}><Icon name={glyph} size={25}/></View>
    <Text style={s.tileTitle}>{title}</Text>{subtitle&&<Text style={s.tileSub}>{subtitle}</Text>}
    <Text style={s.tileArrow}>↗</Text>
  </TouchableOpacity>;
}
function Notice({title,body}:{title:string;body:string}) {
  return <View style={s.notice}><Text style={s.noticeTitle}>{title}</Text><Text style={s.noticeBody}>{body}</Text></View>;
}
export default function App() {
  const [page,setPage]=useState<Page>('Início');
  const localLock=useLocalAppLock();
  const [keystoreProbeBusy,setKeystoreProbeBusy]=useState(false);
  const [keystoreProbeResult,setKeystoreProbeResult]=useState<KeystoreProbeResult|null>(null);
  const keystoreProbeEpoch=useRef(0);
  const keystoreProbeRunning=useRef(false);
  const [nativeFinanceDiagnostic,setNativeFinanceDiagnostic]=useState<NativeFinanceReadiness|null>(null);
  const [nativeFinanceDiagnosticBusy,setNativeFinanceDiagnosticBusy]=useState(false);
  const nativeFinanceDiagnosticEpoch=useRef(0);
  const nativeFinanceDiagnosticRunning=useRef(false);
  const checkNativeFinanceDiagnostic=async()=>{
    // Diagnóstico INFORMATIVO apenas; nenhum segredo ou autorização é enviado.
    if(nativeFinanceDiagnosticRunning.current||AppState.currentState!=='active')return;
    const ticket=++nativeFinanceDiagnosticEpoch.current;
    nativeFinanceDiagnosticRunning.current=true;
    setNativeFinanceDiagnosticBusy(true);
    setNativeFinanceDiagnostic(null);
    try{
      const result=await inspectNativeFinanceReadiness(
        Platform.OS,getOptionalNativeFinanceDiagnosticHost());
      if(ticket===nativeFinanceDiagnosticEpoch.current&&AppState.currentState==='active')
        setNativeFinanceDiagnostic(result);
    }finally{
      if(ticket===nativeFinanceDiagnosticEpoch.current){
        nativeFinanceDiagnosticRunning.current=false;
        setNativeFinanceDiagnosticBusy(false);
      }
    }
  };
  const checkKeystore=async()=>{
    if(localLock.status!=='unlocked'||keystoreProbeRunning.current||AppState.currentState!=='active')return;
    const ticket=++keystoreProbeEpoch.current;
    keystoreProbeRunning.current=true;
    setKeystoreProbeBusy(true);
    setKeystoreProbeResult(null);
    try{
      // A SecureStore authentication prompt may temporarily mark Android inactive.
      const result=await localLock.withProtectedNativePrompt(
        ()=>runKeystoreProbe(SecureStore,LocalAuthentication,Platform.OS));
      if(ticket===keystoreProbeEpoch.current&&AppState.currentState==='active')
        setKeystoreProbeResult(result);
    }catch{
      if(ticket===keystoreProbeEpoch.current&&AppState.currentState==='active')
        setKeystoreProbeResult({status:'failed',message:'Falha inesperada no teste local. Nenhuma chave financeira foi criada.'});
    }finally{
      keystoreProbeRunning.current=false;
      if(ticket===keystoreProbeEpoch.current)setKeystoreProbeBusy(false);
    }
  };
  useEffect(()=>{
    const listener=AppState.addEventListener('change',next=>{
      if(next==='background'){
        keystoreProbeEpoch.current++;
        setKeystoreProbeResult(null);
        setKeystoreProbeBusy(false);
        nativeFinanceDiagnosticEpoch.current++;
        nativeFinanceDiagnosticRunning.current=false;
        setNativeFinanceDiagnostic(null);
        setNativeFinanceDiagnosticBusy(false);
      }
    });
    return()=>listener.remove();
  },[]);
  useEffect(()=>{
    if(page!=='Ajustes'){
      keystoreProbeEpoch.current++;
      setKeystoreProbeResult(null);
      nativeFinanceDiagnosticEpoch.current++;
      nativeFinanceDiagnosticRunning.current=false;
      setNativeFinanceDiagnostic(null);
      setNativeFinanceDiagnosticBusy(false);
    }
  },[page]);
  const [boletoLine,setBoletoLine]=useState('');
  const [boletoResult,setBoletoResult]=useState<ReturnType<typeof inspectBoleto>|null>(null);
  const [reportExportStatus,setReportExportStatus]=useState('');
  const [cnpj,setCnpj]=useState('');
  const [cnpjResult,setCnpjResult]=useState<CompanyResult|null>(null);
  const [cnpjLoading,setCnpjLoading]=useState(false);
  const cnpjRequestId=useRef(0);
  const reportRequestId=useRef(0);
  const [historyQuery,setHistoryQuery]=useState('');
  const clearCurrentAnalysis=useCallback(()=>{cnpjRequestId.current++;reportRequestId.current++;setBoletoLine('');setBoletoResult(null);setCnpj('');setCnpjResult(null);setCnpjLoading(false);setReportExportStatus('');setHistoryQuery('');},[]);
  useEffect(()=>{
    // A biometric lock transition invalidates any in-flight PDF before sharing.
    if(localLock.status!=='off'&&localLock.status!=='unlocked'){
      reportRequestId.current++;
      setReportExportStatus('');
    }
  },[localLock.status]);
  const exportLocalPdf=async()=>{
    if(!boletoResult||AppState.currentState!=='active'||
       (localLock.status!=='off'&&localLock.status!=='unlocked'))return;
    const requestId=++reportRequestId.current;
    setReportExportStatus('Gerando PDF local...');
    const html=renderReportHtml(createLocalReport(boletoResult,new Date().toLocaleString('pt-BR'),cnpjResult));
    const outcome=await exportPdfWithLifecycleGuard({
      html,
      print:content=>Print.printToFileAsync({html:content}),
      sharingAvailable:()=>Sharing.isAvailableAsync(),
      share:uri=>Sharing.shareAsync(uri,{mimeType:'application/pdf',dialogTitle:'Compartilhar relatório do Guardião'}),
      isCurrent:()=>reportRequestId.current===requestId&&AppState.currentState==='active'
    });
    if(reportRequestId.current!==requestId||AppState.currentState!=='active')return;
    if(outcome==='shared')setReportExportStatus('PDF gerado. Escolha onde salvar ou compartilhar.');
    else if(outcome==='unavailable')setReportExportStatus('PDF gerado no armazenamento temporário, mas o compartilhamento não está disponível.');
    else if(outcome==='failed')setReportExportStatus('Não foi possível gerar ou compartilhar o PDF.');
    else setReportExportStatus('');
  };
  const [guardiaoHistory,setGuardiaoHistory]=useState<{id:string;date:string;kind:string;valid:boolean;digits:number}[]>([]);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const [historyStorageError,setHistoryStorageError]=useState('');
  const historyQueue=useRef(createHistoryWriteQueue(SecureStore));
  const skipNextHistorySave=useRef(false);
  const historySequence=useRef(0);
  useEffect(()=>{let active=true;loadHistory(SecureStore).then(v=>{if(active)setGuardiaoHistory(v);}).catch(()=>{if(active)setHistoryStorageError('Armazenamento seguro indisponível. Histórico temporário.');}).finally(()=>{if(active)setHistoryLoaded(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(!historyLoaded||historyStorageError)return;if(skipNextHistorySave.current&&guardiaoHistory.length===0){skipNextHistorySave.current=false;return;}skipNextHistorySave.current=false;historyQueue.current.save(guardiaoHistory).catch(()=>setHistoryStorageError('Falha ao salvar histórico seguro.'));},[guardiaoHistory,historyLoaded,historyStorageError]);
  const [showBalance,setShowBalance]=useState(false);
  const [compact,setCompact]=useState(false);
  const [accent,setAccent]=useState(false);
  const [fontLarge,setFontLarge]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(false);
  const [demoMessage,setDemoMessage]=useState('');
  const [demoMessages,setDemoMessages]=useState<string[]>([]);
  const clearAssistantPreview=useCallback(()=>{setDemoMessage('');setDemoMessages([]);},[]);
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',nextState=>{
      if(shouldClearSensitiveOnAppState(nextState)){
        clearCurrentAnalysis();
        clearAssistantPreview();
        setShowBalance(false);
      }
    });
    return()=>subscription.remove();
  },[clearCurrentAnalysis,clearAssistantPreview]);
  const [assistantStyle,setAssistantStyle]=useState<'acolhedora'|'objetiva'>('acolhedora');
  const [preferencesLoaded,setPreferencesLoaded]=useState(false);
  const [preferencesCanSave,setPreferencesCanSave]=useState(true);
  const [preferencesStorageError,setPreferencesStorageError]=useState('');
  const preferenceWriter=useRef(createPreferenceWriteQueue(AsyncStorage));
  useEffect(()=>{let alive=true;AsyncStorage.getItem(PREFERENCES_STORAGE_KEY).then(raw=>{if(!alive)return;const p=decodePreferences(raw);setAccent(p.accent);setCompact(p.compact);setFontLarge(p.fontLarge);setReducedMotion(p.reducedMotion);setAssistantStyle(p.assistantStyle);}).catch(()=>{if(alive){setPreferencesCanSave(false);setPreferencesStorageError('Não foi possível carregar as preferências. Nenhuma configuração salva será sobrescrita nesta sessão.');}}).finally(()=>{if(alive)setPreferencesLoaded(true);});return()=>{alive=false;};},[]);
  useEffect(()=>{if(!preferencesLoaded||!preferencesCanSave)return;preferenceWriter.current.save({accent,compact,fontLarge,reducedMotion,assistantStyle}).then(()=>setPreferencesStorageError('')).catch(()=>setPreferencesStorageError('Falha ao salvar preferências neste aparelho. As mudanças podem não persistir.'));},[preferencesLoaded,preferencesCanSave,accent,compact,fontLarge,reducedMotion,assistantStyle]);
  const enter=useRef(new Animated.Value(0)).current;
  useEffect(()=>{enter.setValue(0);Animated.timing(enter,{toValue:1,duration:reducedMotion?0:380,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();},[page,enter,reducedMotion]);
  const blue=accent?'#A28BFF':C.blue;
  const nav=(p:Page)=>{
    if(shouldClearSensitiveOnNavigation(page,p)){
      if(page==='Guardião')clearCurrentAnalysis();
      if(page==='Negresco')clearAssistantPreview();
    }
    setPage(p);
  };
  const active=sections.find(x=>x.name===page);
  const evidenceReview=buildEvidenceReview(boletoResult,cnpjResult);
  return <SafeAreaView style={[s.root,{paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??24):0}]}>
    {shouldProtectScreenCapture(page,localLock.status)&&<ProtectedScreenCapture/>}
    <StatusBar backgroundColor="#000000" barStyle="light-content"/>
    {localLock.status==='off'||localLock.status==='unlocked'?<>
    <View style={s.header}>
      <View style={[s.logo,{borderColor:blue}]}><Text style={s.logoText}>N</Text></View>
      <View style={s.headerText}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={s.brand}>NEGRESCO <Text style={{color:blue}}>FINANCE</Text></Text><Text numberOfLines={1} style={s.tagline}>SEU UNIVERSO FINANCEIRO</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir ajustes" onPress={()=>nav('Ajustes')} style={s.headerButton}><Icon name="settings" color={blue} size={22}/></TouchableOpacity>
    </View>
    <Animated.View style={[s.animatedPage,{opacity:enter,transform:[{translateY:enter.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}]}><ScrollView key={page} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {page==='Início'?<>
        <View style={s.eyebrow}><View style={[s.dot,{backgroundColor:blue}]}/><Text style={[s.eyebrowText,{color:blue}]}>PAINEL PRINCIPAL</Text><Text style={s.preview}>MODO PRÉVIA</Text></View>
        <Text style={[s.heading,fontLarge&&{fontSize:39,lineHeight:47}]}>Seu universo,{"\n"}suas escolhas.</Text>
        <Text style={[s.description,fontLarge&&{fontSize:17,lineHeight:26}]}>Tudo que importa para sua vida financeira, em um só lugar.</Text>
        <View style={s.visualBanner}><View style={s.bannerCopy}><Text style={s.bannerLabel}>NEGRESCO FINANCE</Text><Text style={s.bannerTitle}>Seu dinheiro.{"\n"}Seu ritmo.</Text><Text style={s.bannerText}>Uma nova forma de visualizar suas finanças.</Text></View><View style={s.bannerOrb}><Text style={s.bannerOrbText}>N</Text></View></View>
        <View style={s.balance}>
          <View style={s.rowBetween}><Text style={s.overline}>PATRIMÔNIO CONSOLIDADO</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Alternar visibilidade do saldo" onPress={()=>setShowBalance(!showBalance)}><Icon name="eye" color={blue} size={22}/></TouchableOpacity></View>
          <Text style={s.amount}>{showBalance?'Indisponível':'R$ ••••••'}</Text>
          <Text style={[s.balanceHint,{color:blue}]}>●  Nenhuma conta conectada</Text>
          <View style={s.separator}/>
          <View style={s.rowBetween}><Text style={s.balanceFooter}>Seus dados, suas permissões.</Text><Text style={{color:blue,fontSize:22}}>✧</Text></View>
        </View>
        <View style={s.sectionHeading}><Text style={s.sectionTitle}>Acesso rápido</Text><Text style={s.sectionCaption}>SEUS ATALHOS</Text></View>
        <View style={s.quickRow}>{[{name:'Pix',glyph:'pix'},{name:'Contas',glyph:'accounts'},{name:'Cartões',glyph:'cards'},{name:'Metas',glyph:'goals'}].map(x=><TouchableOpacity key={x.name} accessibilityRole="button" accessibilityLabel={'Abrir '+x.name} onPress={()=>nav(x.name as Page)} style={s.quick}><View style={s.quickIcon}><Icon name={x.glyph as IconName} size={27} color={blue}/></View><Text style={s.quickText}>{x.name}</Text></TouchableOpacity>)}</View>
        <View style={s.sectionHeading}><Text style={s.sectionTitle}>Explore seu espaço</Text><Text style={s.sectionCaption}>07 MÓDULOS</Text></View>
        <View style={s.grid}>{sections.map(x=><Tap key={x.name} title={x.name} subtitle={compact?undefined:x.description} glyph={x.glyph} onPress={()=>nav(x.name)} style={compact?{minHeight:115}:undefined}/>)}</View>
        <Notice title="Construído para evoluir" body="Prévia segura: sem contas conectadas e sem movimentações financeiras reais."/>
      </>:page==='Pix'?<>
        <Text style={s.kicker}>TRANSFERÊNCIAS</Text><Text style={s.heading}>Pix do seu jeito.</Text><Text style={s.description}>Tudo preparado para uma experiência rápida e transparente.</Text>
        <Notice title="Pix em demonstração" body="Nenhuma transferência, cobrança ou QR Code real é gerado nesta versão."/>
        <Text style={s.sectionTitle}>Escolha uma operação</Text>
        <View style={s.grid}>{[['Enviar Pix','pix'],['Receber Pix','accounts'],['Ler QR Code','cards'],['Copia e cola','accounts']].map(x=><View key={x[0]} style={s.tile}><View style={s.tileGlyph}><Icon name={x[1] as IconName} size={24}/></View><Text style={s.tileTitle}>{x[0]}</Text><Text style={s.tileSub}>Em desenvolvimento</Text></View>)}</View>
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Uma experiência sem atrito</Text><Text style={s.visualFeatureBody}>Uma prévia do futuro fluxo Pix, com revisão clara, segurança e transparência em cada etapa.</Text><View style={s.visualSteps}>{['01  Identificar','02  Conferir','03  Autorizar'].map(t=><View key={t} style={s.visualStep}><Text style={s.visualStepText}>{t}</Text></View>)}</View></View>
      </>:page==='Negresco'?<>
        <View style={s.eyebrow}><View style={[s.dot,{backgroundColor:blue}]}/><Text style={[s.eyebrowText,{color:blue}]}>ESPAÇO NEGRESCO</Text><Text style={s.preview}>DEMONSTRAÇÃO</Text></View>
        <Text style={[s.heading,fontLarge&&{fontSize:39,lineHeight:47}]}>Sua assistente.{"\n"}Seu jeito.</Text>
        <Text style={[s.description,fontLarge&&{fontSize:17,lineHeight:26}]}>Uma experiência financeira mais humana, feita para conversar com você.</Text>
        <View style={s.assistantHero}>
          <View style={s.assistantHeroTop}>
            <View style={[s.avatarHalo,{borderColor:blue+'88'}]}><View style={[s.avatarInner,{backgroundColor:blue}]}><Text style={s.avatarLetter}>N</Text></View><View style={s.avatarSpark}><Icon name="assistant" size={15} color={blue}/></View></View>
            <View style={s.assistantIdentity}><Text style={s.assistantName}>Negresco</Text><Text style={s.assistantRole}>SUA ASSISTENTE FINANCEIRA</Text><View style={s.assistantStatus}><View style={s.statusAmber}/><Text style={s.assistantStatusText}>Modo de demonstração</Text></View></View>
          </View>
          <View style={s.assistantDivider}/>
          <Text style={s.assistantGreeting}>Um espaço para entender suas finanças com mais clareza.</Text>
          <Text style={s.assistantSupporting}>Aqui você já pode experimentar o visual de uma conversa. Nenhuma mensagem é enviada para servidores ou para uma IA.</Text>
        </View>
        <View style={s.chatPanel}>
          <View style={s.rowBetween}><Text style={s.chatTitle}>Prévia de conversa</Text><View style={s.chatBadge}><Text style={s.chatBadgeText}>LOCAL</Text></View></View>
          <View style={s.botBubble}><Text style={s.bubbleLabel}>NEGRESCO · EXEMPLO</Text><Text style={s.bubbleText}>Oi! Este é o espaço onde vamos conversar sobre suas finanças. Por enquanto, estou em modo de demonstração. 💙</Text></View>
          {demoMessages.map((message,index)=><View key={index} style={s.userBubble}><Text style={s.userBubbleText}>{message}</Text></View>)}
          {demoMessages.length>0&&<View style={s.botBubble}><Text style={s.bubbleLabel}>MODO DEMONSTRAÇÃO</Text><Text style={s.bubbleText}>Sua mensagem apareceu apenas nesta tela. A Negresco ainda não está conectada à inteligência artificial.</Text></View>}
          <View style={s.chatComposer}><TextInput accessibilityLabel="Mensagem de demonstração" placeholder="Escreva uma mensagem..." placeholderTextColor="#8295AC" value={demoMessage} onChangeText={setDemoMessage} style={s.chatInput} maxLength={240} multiline/><TouchableOpacity accessibilityRole="button" accessibilityLabel="Mostrar mensagem na demonstração" disabled={!demoMessage.trim()} onPress={()=>{if(demoMessage.trim()){setDemoMessages(x=>[...x.slice(-3),demoMessage.trim()]);setDemoMessage('');}}} style={[s.sendButton,{backgroundColor:demoMessage.trim()?blue:'#24374E'}]}><Text style={s.sendButtonText}>↑</Text></TouchableOpacity></View>
          <Text style={s.chatFootnote}>Prévia local. Mensagens temporárias, sem IA, voz ou envio de dados.</Text>
        </View>
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Personalidade visual</Text><Text style={s.visualFeatureBody}>Experimente como a Negresco poderá se apresentar. Isso altera apenas a prévia, não ativa respostas inteligentes.</Text><View style={s.personalityRow}>{(['acolhedora','objetiva'] as const).map(t=><TouchableOpacity key={t} accessibilityRole="button" accessibilityState={{selected:assistantStyle===t}} onPress={()=>setAssistantStyle(t)} style={[s.personalityButton,assistantStyle===t&&{borderColor:blue,backgroundColor:'#1C3452'}]}><Text style={[s.personalityText,assistantStyle===t&&{color:blue}]}>{t==='acolhedora'?'✦ Acolhedora':'◈ Objetiva'}</Text></TouchableOpacity>)}</View><Text style={s.personalitySample}>{assistantStyle==='acolhedora'?'“Vamos organizar tudo com calma e clareza.”':'“Vamos aos números, prioridades e próximos passos.”'}</Text></View>
        <Notice title="Privacidade em primeiro lugar" body="A Negresco real e os agentes especializados ainda não estão conectados. A CTO coordenará consultas autorizadas quando essa funcionalidade for implementada."/>
      </>:page==='Guardião'?<>
        <View style={s.eyebrow}><View style={[s.dot,{backgroundColor:blue}]}/><Text style={[s.eyebrowText,{color:blue}]}>SEGURANÇA FINANCEIRA</Text><Text style={s.preview}>ANÁLISE LOCAL</Text></View>
        <Text style={s.heading}>Guardião de{"\n"}Boletos.</Text>
        <Text style={s.description}>Confira a estrutura de uma linha digitável antes de pagar. A investigação de empresas e compras exige integrações futuras.</Text>
        <View style={s.formPanel}><Text style={s.formTitle}>Verificar linha digitável</Text><Text style={s.formHelp}>Cole os números de um boleto bancário (47 dígitos) ou de arrecadação (48 dígitos). Não cole dados em sites desconhecidos.</Text>
          <Text style={s.inputLabel}>LINHA DIGITÁVEL</Text>
          <TextInput accessibilityLabel="Linha digitável do boleto" style={s.input} value={boletoLine} onChangeText={v=>{cnpjRequestId.current++;reportRequestId.current++;setBoletoLine(v);setBoletoResult(null);setCnpj('');setCnpjResult(null);setCnpjLoading(false);setReportExportStatus('');}} placeholder="Digite ou cole os números" placeholderTextColor="#8195AE" keyboardType="number-pad" multiline maxLength={80}/>
          <TouchableOpacity accessibilityRole="button" disabled={!historyLoaded} onPress={()=>{reportRequestId.current++;const result=inspectBoleto(boletoLine);setBoletoResult(result);setReportExportStatus('');const id=String(Date.now())+'-'+String(++historySequence.current);setGuardiaoHistory(h=>[{id,date:new Date().toLocaleString('pt-BR'),kind:result.kind,valid:result.valid,digits:result.digits},...h].slice(0,12));}} style={[s.actionButton,{backgroundColor:historyLoaded?blue:'#233951'}]}><Text style={s.actionText}>{historyLoaded?'Analisar estrutura':'Preparando histórico seguro...'}</Text></TouchableOpacity>
        </View>
        {(!!boletoLine||!!cnpj||!!cnpjResult||!!boletoResult)&&<TouchableOpacity accessibilityRole="button" accessibilityLabel="Limpar campos e resultados da análise atual" onPress={clearCurrentAnalysis} style={[s.actionButton,{marginBottom:15,backgroundColor:'#223A59'}]}><Text style={s.actionText}>Limpar dados da análise atual</Text></TouchableOpacity>}
        {boletoResult&&<View style={s.visualFeature}><Text style={s.visualFeatureTitle}>{boletoResult.valid?'Estrutura consistente':'Verificação inconclusiva ou inválida'}</Text><Text style={s.visualFeatureBody}>{boletoResult.explanation}</Text><Text style={[s.visualFeatureBody,{color:'#E3C38C'}]}>Mesmo uma linha digitável válida pode pertencer a uma cobrança fraudulenta. Não pague sem confirmar o beneficiário no banco.</Text><View style={s.visualSteps}><View style={s.visualStep}><Text style={s.visualStepText}>{boletoResult.kind}</Text></View><View style={s.visualStep}><Text style={s.visualStepText}>{boletoResult.digits} DÍGITOS</Text></View></View></View>}
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Quem está cobrando?</Text><Text style={s.visualFeatureBody}>A linha digitável não revela de forma confiável a empresa, o beneficiário final ou a compra que gerou a cobrança. Para isso, precisaremos consultar o registro bancário e cruzar documentos autorizados.</Text>
          {([['Banco que notificou','Não informado'],['Empresa emissora','Não identificada'],['Beneficiário final','Não identificado'],['Banco registrador','Não consultado'],['Compra ou contrato','Origem não identificada']] as const).map(([label,value])=><View key={label} style={[s.rowBetween,{paddingTop:13}]}><Text style={{color:C.muted,fontSize:11,flex:1}}>{label}</Text><Text style={{color:C.white,fontSize:11,fontWeight:'800',flex:1,textAlign:'right'}}>{value}</Text></View>)}
        </View>
        <View style={s.visualFeature}>
          <View style={[s.rowBetween,{alignItems:'center'}]}>
            <Text style={s.visualFeatureTitle}>Mapa de evidências</Text>
            <Text style={{color:'#E2BF83',fontSize:10,fontWeight:'800'}}>INCONCLUSIVO</Text>
          </View>
          <Text style={s.visualFeatureBody}>Cada informação mostra sua origem e o que realmente foi verificado. Respostas de terceiros não comprovam quem emitiu o boleto.</Text>
          {evidenceReview.rows.map(item=><View key={item.id} style={{borderTopWidth:1,borderTopColor:C.line,paddingTop:13,paddingBottom:12}}>
            <View style={[s.rowBetween,{alignItems:'center'}]}>
              <Text style={{color:C.white,fontSize:13,fontWeight:'800',flex:1,marginRight:8}}>{item.title}</Text>
              <View style={{backgroundColor:'#1D2D40',borderRadius:7,paddingHorizontal:8,paddingVertical:5}}>
                <Text style={{fontSize:10,fontWeight:'800',color:evidenceStatusColors[item.status]}}>{evidenceStatusLabels[item.status]}</Text>
              </View>
            </View>
            <Text style={{color:blue,fontSize:11,marginTop:7}}>Fonte: {item.source}</Text>
            <Text style={[s.visualFeatureBody,{marginTop:5}]}>{item.detail}</Text>
          </View>)}
          <Text style={[s.visualFeatureBody,{color:'#E2BF83'}]}>Fontes externas com resposta: {evidenceReview.externalResponses}. Legitimidade da cobrança: não determinada. Confirme o beneficiário no seu banco.</Text>
        </View>
        <View style={s.visualFeature}>
          <Text style={s.visualFeatureTitle}>Relatório de evidências</Text>
          <Text style={s.visualFeatureBody}>O PDF reúne a análise matemática e, se você consultou um CNPJ, registra essa resposta como informação independente. Nenhuma consulta atribui automaticamente a cobrança à empresa.</Text>
          <Text style={s.visualFeatureBody}>O relatório não contém a linha digitável nem o CNPJ completo. Banco, beneficiário, contrato e Reclame Aqui permanecem sem verificação externa.</Text>
        </View>
        {boletoResult&&<TouchableOpacity accessibilityRole="button" onPress={exportLocalPdf} style={[s.actionButton,{backgroundColor:blue,marginBottom:15}]}><Text style={s.actionText}>Gerar e compartilhar relatório PDF</Text></TouchableOpacity>}
        {!!reportExportStatus&&<Text style={[s.visualFeatureBody,{marginBottom:12}]}>{reportExportStatus}</Text>}
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Histórico protegido</Text><Text style={s.visualFeatureBody}>Somente tipo, quantidade de dígitos e resultado estrutural. A linha digitável completa não é armazenada no histórico. Os registros ficam salvos no armazenamento seguro quando disponível.</Text><TextInput accessibilityLabel="Pesquisar histórico" style={s.input} value={historyQuery} onChangeText={setHistoryQuery} placeholder="Pesquisar data, tipo ou resultado" placeholderTextColor="#8195AE"/>{guardiaoHistory.length===0?<Text style={s.visualFeatureBody}>Nenhuma verificação salva.</Text>:guardiaoHistory.filter(item=>(item.date+' '+item.kind+' '+(item.valid?'confere':'não confere')).toLowerCase().includes(historyQuery.toLowerCase())).map(item=><View key={item.id} style={[s.rowBetween,{paddingTop:12}]}><Text style={{color:C.muted,fontSize:11,flex:1}}>{item.date} · {item.kind}</Text><Text style={{color:C.white,fontSize:11,fontWeight:'800'}}>{item.valid?'Dígitos conferem':'Não confere'}</Text></View>)}{guardiaoHistory.length>0&&<TouchableOpacity accessibilityRole="button" onPress={()=>{skipNextHistorySave.current=true;setGuardiaoHistory([]);historyQueue.current.clear().catch(()=>setHistoryStorageError('Falha ao apagar histórico seguro.'));}} style={[s.actionButton,{marginTop:14,backgroundColor:'#223A59'}]}><Text style={s.actionText}>Limpar histórico</Text></TouchableOpacity>}</View>
        {!!historyStorageError&&<Text style={s.visualFeatureBody}>{historyStorageError}</Text>}
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Consultar CNPJ</Text><Text style={s.visualFeatureBody}>Consulta opcional via BrasilAPI, serviço de terceiros. Ao tocar em Consultar cadastro, o CNPJ será enviado ao provedor. Cadastro ativo não garante boleto legítimo.</Text><TextInput accessibilityLabel="CNPJ" style={s.input} value={cnpj} onChangeText={v=>{cnpjRequestId.current++;reportRequestId.current++;setCnpj(v);setCnpjResult(null);setCnpjLoading(false);setReportExportStatus('');}} placeholder="Digite o CNPJ" placeholderTextColor="#8195AE" keyboardType="number-pad" maxLength={18}/><TouchableOpacity accessibilityRole="button" disabled={cnpjLoading} onPress={async()=>{const requestId=++cnpjRequestId.current;setCnpjLoading(true);try{const result=await consultCnpj(cnpj);if(cnpjRequestId.current===requestId){reportRequestId.current++;setCnpjResult(result);setReportExportStatus('');}}finally{if(cnpjRequestId.current===requestId)setCnpjLoading(false);}}} style={[s.actionButton,{backgroundColor:blue}]}><Text style={s.actionText}>{cnpjLoading?'Consultando...':'Consultar cadastro'}</Text></TouchableOpacity>{cnpjResult&&<Text style={s.visualFeatureBody}>{cnpjResult.status==='found'?'Empresa: '+cnpjResult.legalName+' | Situação: '+(cnpjResult.registration||'não informada'):cnpjResult.message||'Consulta indisponível'}{cnpjResult.source?' | Fonte: BrasilAPI (terceiros)':''}</Text>}</View>
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Reputação empresarial</Text><Text style={s.visualFeatureBody}>Reclame Aqui: {availabilityMessage(reclameAqui)} Não exibimos notas, reclamações ou alertas que não foram realmente consultados.</Text></View>
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Monitoramento bancário</Text><Text style={s.visualFeatureBody}>Status: {bankMonitoring.status==='connected'?'Conector configurado':'Desconectado'}. Sem consentimento bancário ativo, não há coleta de boletos, movimentações ou notificações.</Text></View>
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Consultas externas e monitoramento</Text><Text style={s.visualFeatureBody}>CNPJ: consulta opcional via BrasilAPI. Receita Federal direta, Reclame Aqui e bancos: integrações ainda indisponíveis. Monitoramento automático: desligado, sem coleta de notificações ou dados bancários.</Text><Text style={s.visualFeatureBody}>Alertas de risco nesta versão são limitados a inconsistências matemáticas. Não há classificação automática de fraude.</Text></View>
        <Notice title="Atenção antes de pagar" body="Verificar dígitos não comprova que a cobrança seja sua. Confira o nome e CNPJ do beneficiário exibidos no aplicativo oficial do banco e confirme a compra por canais independentes."/>
      </>:page==='Ajustes'?<>
        <Text style={s.kicker}>PERSONALIZAÇÃO</Text><Text style={s.heading}>Do seu jeito.</Text><Text style={s.description}>Ajuste a aparência desta prévia. As escolhas ficam salvas neste aparelho quando o armazenamento estiver disponível.</Text>{!!preferencesStorageError&&<Notice title="Armazenamento local" body={preferencesStorageError}/>}
        <TouchableOpacity accessibilityRole="switch" accessibilityState={{checked:accent}} onPress={()=>setAccent(!accent)} style={s.setting}><Text style={s.settingText}>Cor de destaque</Text><Text style={[s.settingValue,{color:blue}]}>{accent?'Violeta':'Azul'}  ↔</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="switch" accessibilityState={{checked:compact}} onPress={()=>setCompact(!compact)} style={s.setting}><Text style={s.settingText}>Cartões compactos</Text><Text style={[s.settingValue,{color:blue}]}>{compact?'Ligado':'Desligado'}  ↔</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="switch" accessibilityState={{checked:fontLarge}} onPress={()=>setFontLarge(!fontLarge)} style={s.setting}><Text style={s.settingText}>Textos maiores</Text><Text style={[s.settingValue,{color:blue}]}>{fontLarge?'Ligado':'Desligado'}  ↔</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="switch" accessibilityState={{checked:reducedMotion}} onPress={()=>setReducedMotion(!reducedMotion)} style={s.setting}><Text style={s.settingText}>Reduzir animações</Text><Text style={[s.settingValue,{color:blue}]}>{reducedMotion?'Ligado':'Desligado'}  ↔</Text></TouchableOpacity>
        <View style={s.visualFeature}>
          <Text style={s.visualFeatureTitle}>Bloqueio biométrico · prévia</Text>
          <Text style={s.visualFeatureBody}>Opcional. Exige biometria forte cadastrada no Android e bloqueia a interface ao sair do app. Não criptografa o banco, não protege capturas de tela e não é autenticação bancária.</Text>
          <Text style={[s.visualFeatureBody,{color:localLock.enabled?'#9DD9C8':'#E3C28B'}]}>Proteção local: {localLock.enabled?'Ativada':'Desativada'}</Text>
          {localLock.status==='off'?
            <TouchableOpacity accessibilityRole="button" disabled={localLock.busy} onPress={localLock.enable} style={[s.actionButton,{backgroundColor:blue,marginTop:15}]}><Text style={s.actionText}>{localLock.busy?'Verificando...':'Ativar bloqueio com biometria forte'}</Text></TouchableOpacity>
          :localLock.status==='unlocked'?<>
            <TouchableOpacity accessibilityRole="button" disabled={localLock.busy} onPress={localLock.lockNow} style={[s.actionButton,{backgroundColor:'#254F83',marginTop:15}]}><Text style={s.actionText}>Bloquear agora</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={localLock.busy} onPress={localLock.disable} style={[s.actionButton,{backgroundColor:'#22334A',marginTop:11}]}><Text style={s.actionText}>{localLock.busy?'Verificando...':'Desativar bloqueio (confirmar biometria)'}</Text></TouchableOpacity>
          </>:null}
          {!!localLock.message&&<Text style={[s.visualFeatureBody,{color:'#E8C393'}]}>{localLock.message}</Text>}
        </View>
        <View style={s.visualFeature}>
          <Text style={s.visualFeatureTitle}>Privacidade de capturas · Android</Text>
          <Text style={s.visualFeatureBody}>Proteção automática quando você abre o Guardião ou mantém o bloqueio biométrico ativado. O Android deve impedir prints, gravações e miniaturas do aplicativo protegido. Outras telas da prévia continuam capturáveis se o bloqueio estiver desligado.</Text>
          <Text style={[s.visualFeatureBody,{color:'#D9BD8D'}]}>Use o botão de compartilhar do Guardião para exportar relatórios. O bloqueio da tela não protege PDFs fora do aplicativo.</Text>
        </View>
        <View style={s.visualFeature}>
          <Text style={s.visualFeatureTitle}>Diagnóstico Android Keystore · experimental</Text>
          <Text style={s.visualFeatureBody}>Somente para testar no Samsung: grava, lê e apaga um marcador fictício com autenticação exigida pelo Android. Nenhuma chave de banco é criada. O resultado não comprova hardware dedicado nem zero-knowledge.</Text>
          {localLock.status==='unlocked'?
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Testar SecureStore com biometria e dados fictícios" disabled={keystoreProbeBusy} onPress={checkKeystore} style={[s.actionButton,{backgroundColor:'#244876',marginTop:13}]}>
              <Text style={s.actionText}>{keystoreProbeBusy?'Testando proteção...':'Testar proteção do Keystore'}</Text>
            </TouchableOpacity>
            :<Text style={[s.visualFeatureBody,{color:'#DAB882'}]}>Primeiro ative e desbloqueie a proteção biométrica da prévia para executar este diagnóstico.</Text>}
          {keystoreProbeResult&&<Text style={[s.visualFeatureBody,{marginTop:10,color:keystoreProbeResult.status==='passed'?'#9DD9C8':'#E4C18E'}]}>{keystoreProbeResult.message}</Text>}
        </View>
        <View style={s.visualFeature}>
          <Text style={s.visualFeatureTitle}>Segurança financeira nativa · integração pendente</Text>
          <Text style={s.visualFeatureBody}>O SQLCipher, a gestão de chaves e a recuperação ainda estão em laboratórios separados. Este diagnóstico é somente leitura e nunca autoriza guardar dados financeiros.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Verificar presença do módulo financeiro nativo" disabled={nativeFinanceDiagnosticBusy} onPress={checkNativeFinanceDiagnostic} style={[s.actionButton,{backgroundColor:'#244876',marginTop:13}]}>
            <Text style={s.actionText}>{nativeFinanceDiagnosticBusy?'Verificando integração...':'Verificar integração nativa'}</Text>
          </TouchableOpacity>
          {nativeFinanceDiagnostic&&<Text style={[s.visualFeatureBody,{marginTop:10,color:'#D9BD8D'}]}>{nativeFinanceDiagnostic.message}</Text>}
        </View>
        <View style={s.palette}><View style={[s.swatch,{backgroundColor:'#000000',borderColor:'#41536C'}]}/><View style={[s.swatch,{backgroundColor:blue,borderColor:blue}]}/><View style={[s.swatch,{backgroundColor:'#0D111A',borderColor:'#41536C'}]}/><Text style={s.paletteLabel}>PALETA ATIVA</Text></View><Notice title="Tema OLED ativo" body="O fundo preto absoluto foi preservado para telas AMOLED. Preferências visuais e personalidade são salvas neste aparelho. Não armazene dados financeiros nas opções de aparência."/>
      </>:<>
        <Text style={s.kicker}>SEU ESPAÇO</Text><Text style={s.heading}>{page}</Text><Text style={s.description}>{active?.description}</Text>
        <View style={s.empty}><View style={s.emptyGlyph}>{active&&<Icon name={active.glyph} size={45} color={blue}/>}</View><Text style={s.emptyTitle}>Um espaço só seu</Text><Text style={s.emptyBody}>Este módulo ganhará recursos próprios quando houver integrações autorizadas. Por enquanto, não exibimos valores inventados.</Text><View style={s.offline}><Text style={s.offlineText}>●  SEM DADOS CONECTADOS</Text></View></View>
        <View style={s.visualFeature}><Text style={s.visualFeatureTitle}>Um painel preparado para você</Text><Text style={s.visualFeatureBody}>Visualização de informações, atalhos e indicadores ganhará vida quando você autorizar a conexão de dados.</Text></View><Text style={s.sectionTitle}>Explore também</Text><View style={s.grid}>{sections.filter(x=>x.name!==page).map(x=><Tap key={x.name} title={x.name} glyph={x.glyph} onPress={()=>nav(x.name)} style={{minHeight:115}}/>)}</View>
      </>}
    </ScrollView></Animated.View>
    <View style={s.bottom}>{[{name:'Início',glyph:'home'},{name:'Pix',glyph:'pix'},{name:'Negresco',glyph:'assistant'}].map(x=><TouchableOpacity key={x.name} accessibilityRole="tab" accessibilityState={{selected:page===x.name}} onPress={()=>nav(x.name as Page)} style={[s.nav,page===x.name&&s.navSelected]}><Icon name={x.glyph as IconName} size={23} color={page===x.name?blue:'#8898AD'}/><Text style={[s.navLabel,page===x.name&&{color:blue}]}>{x.name}</Text>{page===x.name&&<View style={[s.navMark,{backgroundColor:blue}]}/>}</TouchableOpacity>)}</View>
    </>:<LocalLockScreen status={localLock.status} busy={localLock.busy} message={localLock.message} onUnlock={localLock.unlock} onRetry={localLock.retry}/>}
  </SafeAreaView>;
}
const s=StyleSheet.create({
 assistantHero:{borderRadius:25,borderWidth:1,borderColor:'#31567E',backgroundColor:'#0D1929',padding:20,marginBottom:16},assistantHeroTop:{flexDirection:'row',alignItems:'center'},avatarHalo:{width:78,height:78,borderRadius:26,borderWidth:1,backgroundColor:'#182C45',alignItems:'center',justifyContent:'center',marginRight:15},avatarInner:{width:55,height:55,borderRadius:20,alignItems:'center',justifyContent:'center'},avatarLetter:{color:'#061323',fontSize:34,fontWeight:'900'},avatarSpark:{position:'absolute',right:-5,top:-6,backgroundColor:'#0B1523',borderWidth:1,borderColor:'#35577E',width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center'},assistantIdentity:{flex:1,minWidth:0},assistantName:{fontSize:24,fontWeight:'900',color:C.white},assistantRole:{color:'#9CB7D6',fontSize:9,fontWeight:'900',letterSpacing:1.1,marginTop:5},assistantStatus:{flexDirection:'row',alignItems:'center',marginTop:10},statusAmber:{width:7,height:7,borderRadius:4,backgroundColor:'#E5BB79',marginRight:7},assistantStatusText:{fontSize:11,color:'#E0C49A'},assistantDivider:{height:1,backgroundColor:'#28405D',marginVertical:18},assistantGreeting:{fontSize:17,fontWeight:'900',lineHeight:25,color:C.white},assistantSupporting:{fontSize:12,lineHeight:20,color:'#A8BBD2',marginTop:9},chatPanel:{backgroundColor:'#0D121C',borderWidth:1,borderColor:'#263B56',borderRadius:24,padding:17,marginBottom:16},chatTitle:{color:C.white,fontSize:17,fontWeight:'900'},chatBadge:{paddingHorizontal:10,paddingVertical:5,borderRadius:12,backgroundColor:'#19324B'},chatBadgeText:{fontSize:9,fontWeight:'900',color:'#8CC6FF'},botBubble:{backgroundColor:'#172941',borderRadius:18,borderTopLeftRadius:5,padding:15,marginTop:18,marginRight:20},bubbleLabel:{color:'#8DC2FF',fontSize:9,fontWeight:'900',letterSpacing:1.1,marginBottom:8},bubbleText:{color:'#E1EAF5',fontSize:13,lineHeight:21},userBubble:{alignSelf:'flex-end',maxWidth:'88%',borderRadius:17,borderTopRightRadius:5,backgroundColor:'#28568A',padding:14,marginTop:12},userBubbleText:{color:'#FFFFFF',fontSize:13,lineHeight:20},chatComposer:{flexDirection:'row',alignItems:'flex-end',backgroundColor:'#080E17',borderWidth:1,borderColor:'#324861',borderRadius:18,marginTop:20,padding:6},chatInput:{flex:1,minHeight:42,maxHeight:110,color:C.white,fontSize:13,paddingHorizontal:10,paddingVertical:9},sendButton:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'},sendButtonText:{fontSize:24,fontWeight:'900',color:'#07101D'},chatFootnote:{fontSize:10,color:'#92A6BE',lineHeight:16,marginTop:11},personalityRow:{flexDirection:'row',gap:10,marginTop:16},personalityButton:{flex:1,borderRadius:14,borderWidth:1,borderColor:'#2B405B',backgroundColor:'#111F30',paddingVertical:12,alignItems:'center'},personalityText:{color:'#B8C9DC',fontSize:12,fontWeight:'800'},personalitySample:{color:'#D4E5F8',fontSize:12,fontStyle:'italic',lineHeight:20,marginTop:15},bannerCopy:{flex:1,minWidth:0,paddingRight:10},navSelected:{backgroundColor:'#15253A'},palette:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:20},swatch:{width:34,height:34,borderRadius:12,borderWidth:1},paletteLabel:{color:'#A4B6CB',fontSize:10,fontWeight:'800',letterSpacing:1.4,marginLeft:5},
 animatedPage:{flex:1},visualBanner:{minHeight:158,borderRadius:25,backgroundColor:'#122C4E',borderWidth:1,borderColor:'#3265A1',marginBottom:17,padding:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',overflow:'hidden'},bannerLabel:{color:'#8DC5FF',fontSize:9,fontWeight:'900',letterSpacing:2},bannerTitle:{color:'#FFFFFF',fontSize:23,fontWeight:'900',lineHeight:29,marginTop:9},bannerText:{color:'#B8D0EB',fontSize:10,marginTop:10,flexShrink:1},bannerOrb:{height:70,width:70,borderRadius:35,borderWidth:2,borderColor:'#5D9AE0',backgroundColor:'#214E82',alignItems:'center',justifyContent:'center'},bannerOrbText:{fontSize:40,fontWeight:'900',color:'#C6E4FF'},visualFeature:{backgroundColor:'#0C1624',borderRadius:22,borderWidth:1,borderColor:'#27466C',padding:20,marginBottom:20},visualFeatureTitle:{color:'#F7FAFF',fontSize:17,fontWeight:'900'},visualFeatureBody:{color:'#A9BDD6',fontSize:12,lineHeight:20,marginTop:10},visualSteps:{flexDirection:'row',flexWrap:'wrap',marginTop:18,gap:8},visualStep:{backgroundColor:'#162C47',paddingHorizontal:10,paddingVertical:9,borderRadius:12},visualStepText:{color:'#A5D1FF',fontSize:10,fontWeight:'800'},
 formPanel:{backgroundColor:'#0E1726',borderWidth:1,borderColor:'#355783',borderRadius:22,padding:19,marginBottom:20},formTitle:{color:C.white,fontSize:18,fontWeight:'900'},formHelp:{color:C.muted,fontSize:12,lineHeight:19,marginTop:8,marginBottom:16},inputLabel:{color:'#B9CBE1',fontSize:12,fontWeight:'800',marginBottom:8},input:{color:C.white,backgroundColor:'#080E18',borderColor:C.line,borderWidth:1,borderRadius:14,paddingHorizontal:14,paddingVertical:13,fontSize:14,marginBottom:14},actionButton:{padding:15,borderRadius:14,alignItems:'center',marginTop:4},actionText:{color:'#07101D',fontSize:14,fontWeight:'900'},answer:{color:'#D7E5F8',fontSize:13,lineHeight:22,marginTop:17},
 root:{flex:1,backgroundColor:C.bg},scroll:{flex:1},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:18,paddingTop:12,paddingBottom:17,borderBottomWidth:1,borderBottomColor:'#1B2432'},logo:{width:43,height:43,borderRadius:15,borderWidth:1,backgroundColor:'#16365D',alignItems:'center',justifyContent:'center'},logoText:{fontSize:26,fontWeight:'900',color:'#FFFFFF'},headerText:{flex:1,minWidth:0,marginLeft:12,marginRight:8},brand:{color:C.white,fontSize:14,fontWeight:'900',letterSpacing:.8},tagline:{color:C.muted,fontSize:8,letterSpacing:1.5,marginTop:5},headerButton:{width:40,height:40,borderRadius:20,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
 content:{paddingHorizontal:20,paddingTop:26,paddingBottom:52},eyebrow:{flexDirection:'row',alignItems:'center',marginBottom:20},dot:{height:8,width:8,borderRadius:4,marginRight:9},eyebrowText:{fontSize:11,fontWeight:'900',letterSpacing:2},preview:{color:C.muted,fontSize:9,fontWeight:'800',marginLeft:'auto',borderWidth:1,borderColor:C.line,borderRadius:16,paddingHorizontal:10,paddingVertical:6},heading:{fontSize:35,lineHeight:42,letterSpacing:-1,color:C.white,fontWeight:'900',marginBottom:12},description:{fontSize:14,lineHeight:23,color:C.muted,marginBottom:25},balance:{borderRadius:27,backgroundColor:'#101A2A',borderWidth:1,borderColor:'#355783',padding:23,marginBottom:30},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},overline:{fontSize:10,fontWeight:'900',color:'#A5B6CC',letterSpacing:1.6},eye:{fontSize:24},amount:{fontSize:32,fontWeight:'900',color:C.white,marginTop:20},balanceHint:{fontSize:12,marginTop:12},separator:{height:1,backgroundColor:'#30455F',marginTop:24,marginBottom:15},balanceFooter:{color:'#B1C0D0',fontSize:11},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},sectionTitle:{fontSize:19,fontWeight:'900',color:C.white,marginBottom:15},sectionCaption:{color:'#7188A8',fontSize:9,fontWeight:'800',letterSpacing:1.5},quickRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:34},quick:{width:'24%',alignItems:'center'},quickIcon:{width:62,height:62,backgroundColor:C.raised,borderRadius:21,borderWidth:1,borderColor:C.line,justifyContent:'center',alignItems:'center'},quickGlyph:{fontSize:29},quickText:{fontSize:11,fontWeight:'800',color:'#CED9E8',marginTop:10},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:16},tile:{width:'48%',minHeight:150,borderRadius:22,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:16,marginBottom:13},tileGlyph:{width:36,height:36,borderRadius:12,backgroundColor:'#172B45',justifyContent:'center',alignItems:'center',marginBottom:13},glyph:{fontSize:22,color:C.blue},tileTitle:{color:C.white,fontWeight:'900',fontSize:14},tileSub:{color:C.muted,fontSize:10,marginTop:6,paddingRight:12},tileArrow:{position:'absolute',bottom:12,right:15,color:C.blue,fontSize:18},notice:{backgroundColor:'#0D141F',borderRadius:21,borderWidth:1,borderColor:C.line,padding:19,marginTop:5,marginBottom:16},noticeTitle:{fontSize:14,fontWeight:'900',color:C.white},noticeBody:{fontSize:12,lineHeight:20,color:C.muted,marginTop:8},kicker:{color:C.blue,fontWeight:'900',letterSpacing:2,fontSize:11,marginBottom:17},assistant:{backgroundColor:'#0E1726',borderWidth:1,borderColor:'#36567B',borderRadius:27,padding:25,alignItems:'center',marginBottom:18},assistantOrb:{width:96,height:96,borderRadius:48,backgroundColor:'#1A3150',borderWidth:1,borderColor:'#3A6596',alignItems:'center',justifyContent:'center',marginBottom:20},assistantTitle:{color:C.white,fontSize:22,fontWeight:'900'},assistantBody:{color:C.muted,fontSize:13,lineHeight:22,textAlign:'center',marginTop:13},offline:{backgroundColor:'#1C2431',borderRadius:20,paddingHorizontal:13,paddingVertical:10,marginTop:23},offlineText:{color:'#D3B67F',fontWeight:'800',fontSize:9,letterSpacing:.7},empty:{minHeight:290,borderRadius:26,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:24,alignItems:'center',justifyContent:'center',marginBottom:28},emptyGlyph:{width:78,height:78,borderRadius:24,backgroundColor:'#172A42',alignItems:'center',justifyContent:'center',marginBottom:20},emptyTitle:{fontSize:21,color:C.white,fontWeight:'900'},emptyBody:{fontSize:13,lineHeight:21,color:C.muted,textAlign:'center',marginTop:11},setting:{borderRadius:17,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:20,flexDirection:'row',justifyContent:'space-between',marginBottom:13},settingText:{color:C.white,fontSize:14,fontWeight:'800'},settingValue:{fontSize:12,fontWeight:'900'},bottom:{height:76,paddingHorizontal:12,paddingBottom:4,backgroundColor:'#0C1320',borderTopWidth:1,borderTopColor:'#385779',flexDirection:'row',justifyContent:'space-around'},nav:{width:'31%',alignItems:'center',justifyContent:'center',borderRadius:18,marginVertical:6},navGlyph:{fontSize:24,color:'#8898AD'},navLabel:{fontSize:10,color:'#8898AD',fontWeight:'800',marginTop:3},navMark:{position:'absolute',top:0,width:46,height:3,borderBottomLeftRadius:4,borderBottomRightRadius:4}
});
