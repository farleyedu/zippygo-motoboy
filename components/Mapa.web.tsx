import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Mapa() {
  return (
    <View style={styles.fakeMap}>
      <Text style={{ color: '#888' }}>[ Mapa Web Temporário Aqui ]</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fakeMap: {
    flex: 1,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
