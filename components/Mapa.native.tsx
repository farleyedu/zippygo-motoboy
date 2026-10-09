import React from 'react';
import { Platform, Text, View } from 'react-native';
import { nativeNavigationAvailable } from '../services/nativeNavigation';
import { expoGo } from '../services/expoGo';
import type { MapaProps } from './mapTypes';

export default function Mapa(props: MapaProps) {
  if (nativeNavigationAvailable) {
    const NativeMap = require('./SdkMapa').default as React.ComponentType<MapaProps>;
    return <NativeMap {...props} />;
  }
  if (expoGo || Platform.OS === 'ios') {
    const LegacyMap = require('./LegacyMapa').default as React.ComponentType<MapaProps>;
    return <LegacyMap {...props} />;
  }
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text>Atualize o build do app para carregar o mapa e a navegação.</Text></View>;
}
