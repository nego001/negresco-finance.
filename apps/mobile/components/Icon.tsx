import React from 'react';
import { View } from 'react-native';

export type IconName = 'home'|'pix'|'accounts'|'cards'|'invest'|'goals'|'assistant'|'settings'|'eye'|'arrow';
export function Icon({name,color='#86BDFF',size=24}:{name:IconName;color?:string;size?:number}) {
  const stroke={borderColor:color,borderWidth:2};
  const scale=size/24;
  const canvas={width:size,height:size,alignItems:'center' as const,justifyContent:'center' as const};
  const shape=(width:number,height:number,radius=0)=>({width:width*scale,height:height*scale,borderRadius:radius*scale,...stroke});
  if(name==='home')return <View style={canvas}>
    <View style={{width:15*scale,height:15*scale,position:'absolute',top:5*scale,transform:[{rotate:'45deg'}],borderTopWidth:2,borderLeftWidth:2,borderColor:color,borderTopLeftRadius:2*scale}}/>
    <View style={{width:15*scale,height:11*scale,position:'absolute',bottom:2*scale,borderLeftWidth:2,borderRightWidth:2,borderBottomWidth:2,borderColor:color,borderBottomLeftRadius:2*scale,borderBottomRightRadius:2*scale,alignItems:'center',justifyContent:'flex-end'}}>
      <View style={{width:5*scale,height:7*scale,borderLeftWidth:2,borderRightWidth:2,borderTopWidth:2,borderColor:color}}/>
    </View>
  </View>;
  if(name==='pix')return <View style={canvas}><View style={[shape(15,15,3),{transform:[{rotate:'45deg'}]}]}/><View style={{position:'absolute',width:7*scale,height:7*scale,borderColor:color,borderWidth:2,transform:[{rotate:'45deg'}],backgroundColor:'#0D111A'}}/></View>;
  if(name==='accounts')return <View style={canvas}><View style={[shape(20,16,3),{justifyContent:'center',paddingHorizontal:3*scale}]}><View style={{height:2*scale,width:11*scale,backgroundColor:color,marginBottom:4*scale}}/><View style={{height:2*scale,width:7*scale,backgroundColor:color}}/></View></View>;
  if(name==='cards')return <View style={canvas}><View style={[shape(21,15,3),{justifyContent:'center'}]}><View style={{height:3*scale,backgroundColor:color,marginTop:-3*scale}}/></View></View>;
  if(name==='invest')return <View style={canvas}><View style={{width:20*scale,height:17*scale,borderLeftWidth:2,borderBottomWidth:2,borderColor:color,justifyContent:'flex-end',flexDirection:'row',alignItems:'flex-end',gap:2*scale,paddingHorizontal:3*scale}}>{[5,10,15].map(h=><View key={h} style={{width:3*scale,height:h*scale,backgroundColor:color,borderRadius:2*scale}}/>)}</View></View>;
  if(name==='goals')return <View style={canvas}><View style={[shape(20,20,10),{alignItems:'center',justifyContent:'center'}]}><View style={[shape(10,10,5),{alignItems:'center',justifyContent:'center'}]}><View style={{width:3*scale,height:3*scale,backgroundColor:color,borderRadius:3*scale}}/></View></View></View>;
  if(name==='assistant')return <View style={canvas}><View style={{width:4*scale,height:21*scale,backgroundColor:color,borderRadius:3*scale}}/><View style={{position:'absolute',width:21*scale,height:4*scale,backgroundColor:color,borderRadius:3*scale}}/><View style={{position:'absolute',width:12*scale,height:12*scale,borderWidth:2,borderColor:color,transform:[{rotate:'45deg'}]}}/></View>;
  if(name==='settings')return <View style={canvas}><View style={[shape(19,19,10),{alignItems:'center',justifyContent:'center'}]}><View style={[shape(7,7,4)]}/></View></View>;
  if(name==='eye')return <View style={canvas}><View style={[shape(20,13,8),{alignItems:'center',justifyContent:'center'}]}><View style={{width:6*scale,height:6*scale,borderRadius:4*scale,backgroundColor:color}}/></View></View>;
  return <View style={canvas}><View style={{width:15*scale,height:2*scale,backgroundColor:color,transform:[{rotate:'-35deg'}]}}/><View style={{position:'absolute',right:3*scale,top:3*scale,width:9*scale,height:9*scale,borderRightWidth:2,borderTopWidth:2,borderColor:color}}/></View>;
}
