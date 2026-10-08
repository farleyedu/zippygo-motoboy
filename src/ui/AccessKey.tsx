import React from 'react';
import Svg,{Path} from 'react-native-svg';
// Mesmo desenho do ícone key em prototype.js.
export function AccessKey({color,size=32}:{color:string;size?:number}){
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M10 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0h12m-4 0v4m4-4v3" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}
