import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Tab = 'Início' | 'Contas' | 'Pix' | 'Cartões' | 'Investimentos' | 'Metas' | 'Negresco';
const tabs: Tab[] = ['Início','Contas','Pix','Cartões','Investimentos','Metas','Negresco'];
const details: Record<Tab,string> = {
  'Início':'Seu centro financeiro. Os valores serão exibidos quando houver dados autorizados.',
  'Contas':'Conecte contas via Open Finance quando a integração estiver disponível.',
  'Pix':'Prepare e revise pagamentos. Transferências reais ainda não estão habilitadas.',
  'Cartões':'Gerencie cartões e acompanhe faturas quando houver dados conectados.',
  'Investimentos':'Acompanhe sua carteira e compare cenários, sem operações reais nesta versão.',
  'Metas':'Planeje objetivos financeiros e acompanhe sua evolução.',
  'Negresco':'Sua assistente financeira com coordenação da CTO. Conversa com IA ainda não conectada.'
};
export default function App() {
  const [tab,setTab]=useState<Tab>('Início');
  return <SafeAreaView style={styles.screen}>
    <StatusBar barStyle="light-content" backgroundColor="#000000"/>
    <View style={styles.header}><Text style={styles.brand}>NEGRESCO <Text style={styles.accent}>FINANCE</Text></Text><Text style={styles.subtitle}>Prévia de interface · dados não conectados</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{tab.toUpperCase()}</Text>
      <Text style={styles.title}>{tab==='Início'?'Seu dinheiro, com clareza.':tab}</Text>
      {tab==='Início' && <View style={styles.balance}><Text style={styles.muted}>Saldo consolidado</Text><Text style={styles.value}>Indisponível</Text><Text style={styles.note}>Nenhuma conta conectada</Text></View>}
      <View style={styles.card}><Text style={styles.cardTitle}>{tab==='Negresco'?'Conheça a Negresco': 'Visão geral'}</Text><Text style={styles.description}>{details[tab]}</Text></View>
      <Text style={styles.section}>Explorar módulos</Text>
      <View style={styles.grid}>{tabs.filter(t=>t!=='Início').map(t=><TouchableOpacity accessibilityRole="button" accessibilityLabel={'Abrir '+t} key={t} style={[styles.tile,tab===t&&styles.selected]} onPress={()=>setTab(t)}><Text style={styles.tileText}>{t}</Text><Text style={styles.arrow}>↗</Text></TouchableOpacity>)}</View>
    </ScrollView>
    <View style={styles.bottom}><TouchableOpacity onPress={()=>setTab('Início')}><Text style={[styles.nav,tab==='Início'&&styles.active]}>Início</Text></TouchableOpacity><TouchableOpacity onPress={()=>setTab('Pix')}><Text style={[styles.nav,tab==='Pix'&&styles.active]}>Pix</Text></TouchableOpacity><TouchableOpacity onPress={()=>setTab('Negresco')}><Text style={[styles.nav,tab==='Negresco'&&styles.active]}>Negresco</Text></TouchableOpacity></View>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#000000'},header:{paddingHorizontal:22,paddingTop:24,paddingBottom:16,borderBottomWidth:1,borderColor:'#1D2430'},brand:{fontSize:19,fontWeight:'900',color:'#FFFFFF',letterSpacing:1.2},accent:{color:'#579FF7'},subtitle:{color:'#8D98A8',marginTop:7,fontSize:12},content:{padding:22,paddingBottom:35},eyebrow:{fontSize:11,color:'#579FF7',fontWeight:'800',letterSpacing:2},title:{color:'#FFFFFF',fontSize:27,fontWeight:'800',marginTop:8,marginBottom:20},balance:{padding:22,backgroundColor:'#10151E',borderWidth:1,borderColor:'#27364B',borderRadius:20,marginBottom:18},muted:{color:'#9EAAB8'},value:{color:'#FFFFFF',fontSize:27,fontWeight:'800',marginTop:9},note:{color:'#579FF7',marginTop:7,fontSize:12},card:{padding:19,backgroundColor:'#101013',borderRadius:18,borderWidth:1,borderColor:'#222832'},cardTitle:{fontSize:17,fontWeight:'800',color:'#FFFFFF'},description:{fontSize:14,lineHeight:22,color:'#B5BFCC',marginTop:8},section:{fontSize:16,fontWeight:'800',color:'#FFFFFF',marginTop:26,marginBottom:13},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},tile:{width:'48%',padding:17,minHeight:95,backgroundColor:'#11151C',borderRadius:16,marginBottom:12,borderWidth:1,borderColor:'#232A35',justifyContent:'space-between'},selected:{borderColor:'#579FF7'},tileText:{color:'#FFFFFF',fontWeight:'700'},arrow:{color:'#579FF7',alignSelf:'flex-end',fontSize:19},bottom:{height:65,borderTopWidth:1,borderColor:'#222832',flexDirection:'row',alignItems:'center',justifyContent:'space-around'},nav:{color:'#8D98A8',fontWeight:'700'},active:{color:'#579FF7'}
});
