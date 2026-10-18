import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Tab = 'Início' | 'Contas' | 'Pix' | 'Cartões' | 'Investimentos' | 'Metas' | 'Negresco';
const modules: { name: Exclude<Tab,'Início'>; icon: string; caption: string }[] = [
  {name:'Contas',icon:'▤',caption:'Tudo em um lugar'},
  {name:'Pix',icon:'◇',caption:'Transferências'},
  {name:'Cartões',icon:'▰',caption:'Limites e faturas'},
  {name:'Investimentos',icon:'↗',caption:'Sua carteira'},
  {name:'Metas',icon:'◎',caption:'Seus objetivos'},
  {name:'Negresco',icon:'✦',caption:'Inteligência financeira'}
];
const descriptions: Record<Tab,string> = {
  'Início':'Seu painel financeiro pessoal',
  'Contas':'Suas contas poderão aparecer aqui após uma conexão autorizada.',
  'Pix':'Em breve você poderá preparar e revisar transferências. Nenhum pagamento é realizado nesta versão.',
  'Cartões':'Consulte seus cartões, limites e faturas quando a integração estiver disponível.',
  'Investimentos':'Visualize sua carteira e acompanhe resultados quando houver dados autorizados.',
  'Metas':'Organize seus objetivos e acompanhe cada conquista.',
  'Negresco':'Uma experiência de inteligência financeira em construção. A conversa com IA ainda não está disponível.'
};
function Action({label,icon,onPress}:{label:string;icon:string;onPress:()=>void}) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.action}><View style={s.actionIcon}><Text style={s.actionGlyph}>{icon}</Text></View><Text style={s.actionLabel}>{label}</Text></TouchableOpacity>;
}
export default function App(){
  const [tab,setTab]=useState<Tab>('Início');
  const [visible,setVisible]=useState(false);
  const home=tab==='Início';
  return <SafeAreaView style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor="#000000"/>
    <View style={s.top}>
      <View style={s.brandMark}><Text style={s.brandMarkText}>N</Text></View>
      <View style={s.brandBox}><Text style={s.brand}>NEGRESCO <Text style={s.blue}>FINANCE</Text></Text><Text style={s.brandSub}>SEU UNIVERSO FINANCEIRO</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir Negresco" onPress={()=>setTab('Negresco')} style={s.profile}><Text style={s.profileText}>✦</Text></TouchableOpacity>
    </View>
    <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.kickerRow}><View style={s.liveDot}/><Text style={s.kicker}>{home?'VISÃO GERAL': 'ÁREA FINANCEIRA'}</Text><View style={s.demoPill}><Text style={s.demoText}>PRÉVIA</Text></View></View>
      <Text style={s.headline}>{home?'O controle está\nnas suas mãos.':tab}</Text>
      <Text style={s.lead}>{home?'Tudo o que importa, com mais clareza e menos complicação.':descriptions[tab]}</Text>
      {home ? <>
        <View style={s.hero}>
          <View style={s.heroTop}><Text style={s.heroLabel}>SALDO TOTAL</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={visible?'Ocultar saldo':'Mostrar estado do saldo'} onPress={()=>setVisible(!visible)} style={s.eye}><Text style={s.eyeText}>{visible?'◉':'◎'}</Text></TouchableOpacity></View>
          <Text style={s.heroAmount}>{visible?'Sem contas conectadas':'R$ ••••••'}</Text>
          <Text style={s.heroNote}>●  Nenhuma instituição vinculada</Text>
          <View style={s.heroLine}/>
          <View style={s.heroFoot}><Text style={s.heroFootText}>Seus dados permanecem sob seu controle</Text><Text style={s.heroFootIcon}>✧</Text></View>
        </View>
        <Text style={s.groupTitle}>Acesso rápido</Text>
        <View style={s.actions}>
          <Action label="Pix" icon="◇" onPress={()=>setTab('Pix')}/>
          <Action label="Contas" icon="▤" onPress={()=>setTab('Contas')}/>
          <Action label="Cartões" icon="▰" onPress={()=>setTab('Cartões')}/>
          <Action label="Metas" icon="◎" onPress={()=>setTab('Metas')}/>
        </View>
        <View style={s.sectionRow}><Text style={s.groupTitle}>Seu espaço</Text><Text style={s.sectionHint}>EXPLORE</Text></View>
        <View style={s.grid}>{modules.map(m=><TouchableOpacity accessibilityRole="button" accessibilityLabel={'Abrir '+m.name} key={m.name} onPress={()=>setTab(m.name)} style={s.module}>
          <View style={s.moduleIcon}><Text style={s.moduleGlyph}>{m.icon}</Text></View>
          <Text style={s.moduleName}>{m.name}</Text><Text style={s.moduleCaption}>{m.caption}</Text><Text style={s.moduleArrow}>↗</Text>
        </TouchableOpacity>)}</View>
        <View style={s.notice}><Text style={s.noticeIcon}>✦</Text><View style={s.noticeText}><Text style={s.noticeTitle}>Feito para evoluir com você</Text><Text style={s.noticeBody}>Esta é uma prévia. Integrações financeiras ainda não estão disponíveis.</Text></View></View>
      </> : <>
        <View style={s.feature}><View style={s.featureIcon}><Text style={s.featureGlyph}>{modules.find(m=>m.name===tab)?.icon}</Text></View><Text style={s.featureTitle}>{tab==='Negresco'?'Conheça a Negresco':'Seu espaço de '+tab.toLowerCase()}</Text><Text style={s.featureBody}>{descriptions[tab]}</Text><View style={s.status}><View style={s.statusDot}/><Text style={s.statusText}>Em desenvolvimento · nenhuma operação real</Text></View></View>
        <Text style={s.groupTitle}>Outras áreas</Text>
        <View style={s.grid}>{modules.filter(m=>m.name!==tab).map(m=><TouchableOpacity accessibilityRole="button" accessibilityLabel={'Abrir '+m.name} key={m.name} onPress={()=>setTab(m.name)} style={s.moduleSmall}><Text style={s.smallIcon}>{m.icon}</Text><Text style={s.smallName}>{m.name}</Text><Text style={s.moduleArrow}>↗</Text></TouchableOpacity>)}</View>
      </>}
    </ScrollView>
    <View style={s.bottom}>{([{name:'Início',icon:'⌂'},{name:'Pix',icon:'◇'},{name:'Negresco',icon:'✦'}] as const).map(item=><TouchableOpacity key={item.name} accessibilityRole="tab" accessibilityState={{selected:tab===item.name}} onPress={()=>setTab(item.name)} style={s.navItem}><Text style={[s.navIcon,tab===item.name&&s.navActive]}>{item.icon}</Text><Text style={[s.navText,tab===item.name&&s.navActive]}>{item.name}</Text>{tab===item.name&&<View style={s.navIndicator}/>}</TouchableOpacity>)}</View>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#000'},scroll:{flex:1},top:{paddingHorizontal:21,paddingVertical:17,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#161A22'},brandMark:{height:39,width:39,borderRadius:13,backgroundColor:'#2661AE',alignItems:'center',justifyContent:'center'},brandMarkText:{color:'#fff',fontSize:23,fontWeight:'900'},brandBox:{flex:1,marginLeft:11},brand:{fontSize:15,color:'#fff',fontWeight:'900',letterSpacing:1},blue:{color:'#64AAFF'},brandSub:{fontSize:8,color:'#8894A5',letterSpacing:2,marginTop:4},profile:{width:39,height:39,borderRadius:20,borderWidth:1,borderColor:'#2A3546',backgroundColor:'#111722',alignItems:'center',justifyContent:'center'},profileText:{fontSize:22,color:'#80B8FF'},
 body:{paddingHorizontal:21,paddingTop:26,paddingBottom:32},kickerRow:{flexDirection:'row',alignItems:'center',gap:8},liveDot:{width:7,height:7,borderRadius:4,backgroundColor:'#64AAFF'},kicker:{color:'#82B8FF',fontSize:10,fontWeight:'800',letterSpacing:2},demoPill:{marginLeft:'auto',borderRadius:20,borderWidth:1,borderColor:'#26374D',paddingHorizontal:9,paddingVertical:4},demoText:{color:'#8197B4',fontSize:9,fontWeight:'800',letterSpacing:1},headline:{color:'#fff',fontSize:32,fontWeight:'900',lineHeight:39,letterSpacing:-0.8,marginTop:19},lead:{color:'#9AA6B7',fontSize:13,lineHeight:21,marginTop:9,marginBottom:25},
 hero:{borderRadius:26,borderWidth:1,borderColor:'#304D75',backgroundColor:'#101C2D',padding:23,marginBottom:28},heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroLabel:{color:'#9DAFC5',fontSize:11,fontWeight:'800',letterSpacing:2},eye:{padding:4},eyeText:{color:'#7FB4F5',fontSize:21},heroAmount:{fontSize:32,fontWeight:'900',color:'#fff',marginTop:15,letterSpacing:-0.5},heroNote:{color:'#84B7F1',fontSize:11,marginTop:12},heroLine:{height:1,backgroundColor:'#30445D',marginTop:25,marginBottom:16},heroFoot:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},heroFootText:{color:'#A3B3C8',fontSize:11},heroFootIcon:{color:'#75B4FF',fontSize:20},
 groupTitle:{fontSize:18,fontWeight:'900',color:'#F5F8FF',marginBottom:16},actions:{flexDirection:'row',justifyContent:'space-between',marginBottom:30},action:{alignItems:'center',width:'24%'},actionIcon:{height:60,width:60,borderRadius:19,borderWidth:1,borderColor:'#27354B',backgroundColor:'#111B29',alignItems:'center',justifyContent:'center'},actionGlyph:{fontSize:27,color:'#86BEFF'},actionLabel:{color:'#C5CFDE',fontSize:11,fontWeight:'700',marginTop:9},sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectionHint:{color:'#668BB8',fontSize:9,letterSpacing:2,fontWeight:'800',marginBottom:16},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},module:{width:'48%',minHeight:153,backgroundColor:'#0F141D',borderWidth:1,borderColor:'#222D3D',borderRadius:21,padding:16,marginBottom:13},moduleIcon:{height:38,width:38,borderRadius:12,backgroundColor:'#172840',justifyContent:'center',alignItems:'center',marginBottom:14},moduleGlyph:{fontSize:23,color:'#83B9FF'},moduleName:{color:'#fff',fontSize:14,fontWeight:'800'},moduleCaption:{color:'#8392A6',fontSize:10,marginTop:5},moduleArrow:{color:'#68A9FC',fontSize:17,position:'absolute',right:14,bottom:13},notice:{flexDirection:'row',backgroundColor:'#10151D',borderRadius:19,borderWidth:1,borderColor:'#232B38',padding:17,marginTop:13},noticeIcon:{fontSize:23,color:'#7EB5FF',marginRight:13},noticeText:{flex:1},noticeTitle:{color:'#fff',fontWeight:'800',fontSize:13},noticeBody:{color:'#92A0B3',fontSize:11,lineHeight:17,marginTop:5},
 feature:{backgroundColor:'#101823',borderColor:'#27394F',borderWidth:1,borderRadius:25,padding:24,marginBottom:28,minHeight:230},featureIcon:{height:56,width:56,borderRadius:18,backgroundColor:'#1B3352',alignItems:'center',justifyContent:'center'},featureGlyph:{fontSize:30,color:'#8BC0FF'},featureTitle:{fontSize:23,fontWeight:'900',color:'#fff',marginTop:19},featureBody:{color:'#B3C0D1',fontSize:13,lineHeight:21,marginTop:10},status:{flexDirection:'row',alignItems:'center',marginTop:22},statusDot:{height:7,width:7,borderRadius:4,backgroundColor:'#E3B766',marginRight:8},statusText:{fontSize:10,color:'#C6AE80'},moduleSmall:{width:'48%',height:91,backgroundColor:'#11161F',borderRadius:17,borderWidth:1,borderColor:'#26303E',padding:14,marginBottom:12},smallIcon:{color:'#78B4FC',fontSize:22},smallName:{color:'#fff',fontWeight:'800',fontSize:12,marginTop:7},
 bottom:{height:70,flexDirection:'row',borderTopWidth:1,borderTopColor:'#1B2635',backgroundColor:'#070A10',justifyContent:'space-around',alignItems:'center'},navItem:{height:'100%',width:'30%',alignItems:'center',justifyContent:'center'},navIcon:{color:'#8794A6',fontSize:24},navText:{color:'#8794A6',fontSize:10,fontWeight:'700',marginTop:3},navActive:{color:'#7DB8FF'},navIndicator:{position:'absolute',top:0,height:2,width:36,backgroundColor:'#70AFFF',borderBottomLeftRadius:3,borderBottomRightRadius:3}
});
