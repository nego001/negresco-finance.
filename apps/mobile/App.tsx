import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Page = 'Início' | 'Pix' | 'Contas' | 'Cartões' | 'Investimentos' | 'Metas' | 'Negresco' | 'Ajustes';
const C = { bg:'#000000',panel:'#0D111A',raised:'#121A29',line:'#26354B',blue:'#78B5FF',muted:'#99A8BC',white:'#F7FAFF' };
const sections: {name:Page;glyph:string;description:string}[] = [
  {name:'Contas',glyph:'▤',description:'Instituições e saldos'},
  {name:'Pix',glyph:'↗',description:'Pagamentos e recebimentos'},
  {name:'Cartões',glyph:'▰',description:'Limites e faturas'},
  {name:'Investimentos',glyph:'⌁',description:'Patrimônio e evolução'},
  {name:'Metas',glyph:'◎',description:'Objetivos pessoais'},
  {name:'Negresco',glyph:'✦',description:'Sua assistente financeira'}
];
function Tap({title,subtitle,glyph,onPress,style}:{title:string;subtitle?:string;glyph:string;onPress:()=>void;style?:object}) {
  return <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={title} activeOpacity={0.72} style={[s.tile,style]}>
    <View style={s.tileGlyph}><Text style={s.glyph}>{glyph}</Text></View>
    <Text style={s.tileTitle}>{title}</Text>{subtitle&&<Text style={s.tileSub}>{subtitle}</Text>}
    <Text style={s.tileArrow}>↗</Text>
  </TouchableOpacity>;
}
function Notice({title,body}:{title:string;body:string}) {
  return <View style={s.notice}><Text style={s.noticeTitle}>{title}</Text><Text style={s.noticeBody}>{body}</Text></View>;
}
export default function App() {
  const [page,setPage]=useState<Page>('Início');
  const [showBalance,setShowBalance]=useState(false);
  const [compact,setCompact]=useState(false);
  const [accent,setAccent]=useState(false);
  const blue=accent?'#A28BFF':C.blue;
  const nav=(p:Page)=>setPage(p);
  const active=sections.find(x=>x.name===page);
  return <SafeAreaView style={s.root}>
    <StatusBar backgroundColor="#000000" barStyle="light-content"/>
    <View style={s.header}>
      <View style={[s.logo,{borderColor:blue}]}><Text style={s.logoText}>N</Text></View>
      <View style={s.headerText}><Text style={s.brand}>NEGRESCO <Text style={{color:blue}}>FINANCE</Text></Text><Text style={s.tagline}>SEU UNIVERSO FINANCEIRO</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir ajustes" onPress={()=>nav('Ajustes')} style={s.headerButton}><Text style={{fontSize:21,color:blue}}>⚙</Text></TouchableOpacity>
    </View>
    <ScrollView key={page} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {page==='Início'?<>
        <View style={s.eyebrow}><View style={[s.dot,{backgroundColor:blue}]}/><Text style={[s.eyebrowText,{color:blue}]}>PAINEL PRINCIPAL</Text><Text style={s.preview}>MODO PRÉVIA</Text></View>
        <Text style={s.heading}>Seu universo,{"\n"}suas escolhas.</Text>
        <Text style={s.description}>Tudo que importa para sua vida financeira, em um só lugar.</Text>
        <View style={s.balance}>
          <View style={s.rowBetween}><Text style={s.overline}>PATRIMÔNIO CONSOLIDADO</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Alternar visibilidade do saldo" onPress={()=>setShowBalance(!showBalance)}><Text style={[s.eye,{color:blue}]}>{showBalance?'◉':'◎'}</Text></TouchableOpacity></View>
          <Text style={s.amount}>{showBalance?'Indisponível':'R$ ••••••'}</Text>
          <Text style={[s.balanceHint,{color:blue}]}>●  Nenhuma conta conectada</Text>
          <View style={s.separator}/>
          <View style={s.rowBetween}><Text style={s.balanceFooter}>Seus dados, suas permissões.</Text><Text style={{color:blue,fontSize:22}}>✧</Text></View>
        </View>
        <View style={s.sectionHeading}><Text style={s.sectionTitle}>Acesso rápido</Text><Text style={s.sectionCaption}>SEUS ATALHOS</Text></View>
        <View style={s.quickRow}>{[{name:'Pix',glyph:'↗'},{name:'Contas',glyph:'▤'},{name:'Cartões',glyph:'▰'},{name:'Metas',glyph:'◎'}].map(x=><TouchableOpacity key={x.name} accessibilityRole="button" accessibilityLabel={'Abrir '+x.name} onPress={()=>nav(x.name as Page)} style={s.quick}><View style={s.quickIcon}><Text style={[s.quickGlyph,{color:blue}]}>{x.glyph}</Text></View><Text style={s.quickText}>{x.name}</Text></TouchableOpacity>)}</View>
        <View style={s.sectionHeading}><Text style={s.sectionTitle}>Explore seu espaço</Text><Text style={s.sectionCaption}>06 MÓDULOS</Text></View>
        <View style={s.grid}>{sections.map(x=><Tap key={x.name} title={x.name} subtitle={compact?undefined:x.description} glyph={x.glyph} onPress={()=>nav(x.name)} style={compact?{minHeight:115}:undefined}/>)}</View>
        <Notice title="Construído para evoluir" body="Prévia segura: sem contas conectadas e sem movimentações financeiras reais."/>
      </>:page==='Pix'?<>
        <Text style={s.kicker}>TRANSFERÊNCIAS</Text><Text style={s.heading}>Pix do seu jeito.</Text><Text style={s.description}>Tudo preparado para uma experiência rápida e transparente.</Text>
        <Notice title="Pix em demonstração" body="Nenhuma transferência, cobrança ou QR Code real é gerado nesta versão."/>
        <Text style={s.sectionTitle}>O que você poderá fazer</Text>
        <View style={s.grid}>{[['Enviar Pix','↗'],['Receber Pix','↓'],['Ler QR Code','▦'],['Copia e cola','▤']].map(x=><Tap key={x[0]} title={x[0]} subtitle="Em desenvolvimento" glyph={x[1]} onPress={()=>{}}/>)}</View>
      </>:page==='Negresco'?<>
        <Text style={s.kicker}>INTELIGÊNCIA FINANCEIRA</Text><Text style={s.heading}>Conheça a{"\n"}Negresco. ✦</Text><Text style={s.description}>Uma assistente com personalidade, projetada para ajudar você a entender suas finanças.</Text>
        <View style={s.assistant}><View style={s.assistantOrb}><Text style={{color:blue,fontSize:39}}>✦</Text></View><Text style={s.assistantTitle}>Sua assistente, seu estilo.</Text><Text style={s.assistantBody}>No futuro, a Negresco poderá consultar agentes especializados sob coordenação da CTO, respeitando suas autorizações.</Text><View style={s.offline}><Text style={s.offlineText}>●  CONVERSA AINDA NÃO CONECTADA</Text></View></View>
        <Notice title="Privacidade primeiro" body="A IA não está ativa nesta prévia. Nenhum dado financeiro é enviado para uma conversa."/>
      </>:page==='Ajustes'?<>
        <Text style={s.kicker}>PERSONALIZAÇÃO</Text><Text style={s.heading}>Do seu jeito.</Text><Text style={s.description}>Ajuste a aparência desta prévia sem alterar seus dados.</Text>
        <TouchableOpacity accessibilityRole="switch" accessibilityState={{checked:accent}} onPress={()=>setAccent(!accent)} style={s.setting}><Text style={s.settingText}>Cor de destaque</Text><Text style={[s.settingValue,{color:blue}]}>{accent?'Violeta':'Azul'}  ↔</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="switch" accessibilityState={{checked:compact}} onPress={()=>setCompact(!compact)} style={s.setting}><Text style={s.settingText}>Cartões compactos</Text><Text style={[s.settingValue,{color:blue}]}>{compact?'Ligado':'Desligado'}  ↔</Text></TouchableOpacity>
        <Notice title="Tema OLED ativo" body="O fundo preto absoluto foi preservado para telas AMOLED. Preferências são temporárias nesta versão."/>
      </>:<>
        <Text style={s.kicker}>SEU ESPAÇO</Text><Text style={s.heading}>{page}</Text><Text style={s.description}>{active?.description}</Text>
        <View style={s.empty}><View style={s.emptyGlyph}><Text style={{fontSize:39,color:blue}}>{active?.glyph}</Text></View><Text style={s.emptyTitle}>Um espaço só seu</Text><Text style={s.emptyBody}>Este módulo ganhará recursos próprios quando houver integrações autorizadas. Por enquanto, não exibimos valores inventados.</Text><View style={s.offline}><Text style={s.offlineText}>●  SEM DADOS CONECTADOS</Text></View></View>
        <Text style={s.sectionTitle}>Explore também</Text><View style={s.grid}>{sections.filter(x=>x.name!==page).map(x=><Tap key={x.name} title={x.name} glyph={x.glyph} onPress={()=>nav(x.name)} style={{minHeight:115}}/>)}</View>
      </>}
    </ScrollView>
    <View style={s.bottom}>{[{name:'Início',glyph:'⌂'},{name:'Pix',glyph:'↗'},{name:'Negresco',glyph:'✦'}].map(x=><TouchableOpacity key={x.name} accessibilityRole="tab" accessibilityState={{selected:page===x.name}} onPress={()=>nav(x.name as Page)} style={s.nav}><Text style={[s.navGlyph,page===x.name&&{color:blue}]}>{x.glyph}</Text><Text style={[s.navLabel,page===x.name&&{color:blue}]}>{x.name}</Text>{page===x.name&&<View style={[s.navMark,{backgroundColor:blue}]}/>}</TouchableOpacity>)}</View>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},scroll:{flex:1},header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:14,paddingBottom:17,borderBottomWidth:1,borderBottomColor:'#1B2432'},logo:{width:43,height:43,borderRadius:15,borderWidth:1,backgroundColor:'#16365D',alignItems:'center',justifyContent:'center'},logoText:{fontSize:26,fontWeight:'900',color:'#FFFFFF'},headerText:{flex:1,marginLeft:12},brand:{color:C.white,fontSize:15,fontWeight:'900',letterSpacing:.8},tagline:{color:C.muted,fontSize:9,letterSpacing:2,marginTop:5},headerButton:{width:40,height:40,borderRadius:20,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
 content:{paddingHorizontal:20,paddingTop:26,paddingBottom:42},eyebrow:{flexDirection:'row',alignItems:'center',marginBottom:20},dot:{height:8,width:8,borderRadius:4,marginRight:9},eyebrowText:{fontSize:11,fontWeight:'900',letterSpacing:2},preview:{color:C.muted,fontSize:9,fontWeight:'800',marginLeft:'auto',borderWidth:1,borderColor:C.line,borderRadius:16,paddingHorizontal:10,paddingVertical:6},heading:{fontSize:35,lineHeight:42,letterSpacing:-1,color:C.white,fontWeight:'900',marginBottom:12},description:{fontSize:14,lineHeight:23,color:C.muted,marginBottom:25},balance:{borderRadius:27,backgroundColor:'#101A2A',borderWidth:1,borderColor:'#355783',padding:23,marginBottom:30},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},overline:{fontSize:10,fontWeight:'900',color:'#A5B6CC',letterSpacing:1.6},eye:{fontSize:24},amount:{fontSize:32,fontWeight:'900',color:C.white,marginTop:20},balanceHint:{fontSize:12,marginTop:12},separator:{height:1,backgroundColor:'#30455F',marginTop:24,marginBottom:15},balanceFooter:{color:'#B1C0D0',fontSize:11},sectionHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},sectionTitle:{fontSize:19,fontWeight:'900',color:C.white,marginBottom:15},sectionCaption:{color:'#7188A8',fontSize:9,fontWeight:'800',letterSpacing:1.5},quickRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:34},quick:{width:'24%',alignItems:'center'},quickIcon:{width:62,height:62,backgroundColor:C.raised,borderRadius:21,borderWidth:1,borderColor:C.line,justifyContent:'center',alignItems:'center'},quickGlyph:{fontSize:29},quickText:{fontSize:11,fontWeight:'800',color:'#CED9E8',marginTop:10},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:16},tile:{width:'48%',minHeight:150,borderRadius:22,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:16,marginBottom:13},tileGlyph:{width:36,height:36,borderRadius:12,backgroundColor:'#172B45',justifyContent:'center',alignItems:'center',marginBottom:13},glyph:{fontSize:22,color:C.blue},tileTitle:{color:C.white,fontWeight:'900',fontSize:14},tileSub:{color:C.muted,fontSize:10,marginTop:6,paddingRight:12},tileArrow:{position:'absolute',bottom:12,right:15,color:C.blue,fontSize:18},notice:{backgroundColor:'#0D141F',borderRadius:21,borderWidth:1,borderColor:C.line,padding:19,marginTop:5,marginBottom:16},noticeTitle:{fontSize:14,fontWeight:'900',color:C.white},noticeBody:{fontSize:12,lineHeight:20,color:C.muted,marginTop:8},kicker:{color:C.blue,fontWeight:'900',letterSpacing:2,fontSize:11,marginBottom:17},assistant:{backgroundColor:'#0E1726',borderWidth:1,borderColor:'#36567B',borderRadius:27,padding:25,alignItems:'center',marginBottom:18},assistantOrb:{width:96,height:96,borderRadius:48,backgroundColor:'#1A3150',borderWidth:1,borderColor:'#3A6596',alignItems:'center',justifyContent:'center',marginBottom:20},assistantTitle:{color:C.white,fontSize:22,fontWeight:'900'},assistantBody:{color:C.muted,fontSize:13,lineHeight:22,textAlign:'center',marginTop:13},offline:{backgroundColor:'#1C2431',borderRadius:20,paddingHorizontal:13,paddingVertical:10,marginTop:23},offlineText:{color:'#D3B67F',fontWeight:'800',fontSize:9,letterSpacing:.7},empty:{minHeight:290,borderRadius:26,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:24,alignItems:'center',justifyContent:'center',marginBottom:28},emptyGlyph:{width:78,height:78,borderRadius:24,backgroundColor:'#172A42',alignItems:'center',justifyContent:'center',marginBottom:20},emptyTitle:{fontSize:21,color:C.white,fontWeight:'900'},emptyBody:{fontSize:13,lineHeight:21,color:C.muted,textAlign:'center',marginTop:11},setting:{borderRadius:17,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,padding:20,flexDirection:'row',justifyContent:'space-between',marginBottom:13},settingText:{color:C.white,fontSize:14,fontWeight:'800'},settingValue:{fontSize:12,fontWeight:'900'},bottom:{height:68,backgroundColor:'#080C13',borderTopWidth:1,borderTopColor:'#243044',flexDirection:'row',justifyContent:'space-around'},nav:{width:'30%',alignItems:'center',justifyContent:'center'},navGlyph:{fontSize:24,color:'#8898AD'},navLabel:{fontSize:10,color:'#8898AD',fontWeight:'800',marginTop:3},navMark:{position:'absolute',top:0,width:38,height:3,borderBottomLeftRadius:4,borderBottomRightRadius:4}
});
