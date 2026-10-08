import React, { useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import {
  browserNativeTest,
  browserMockSnapshot,
  reportBrowserMock,
  subscribeBrowserMock,
} from '../../services/browserNativeTest';

export function BrowserTestBanner() {
  const action = useSyncExternalStore(
    subscribeBrowserMock,
    browserMockSnapshot,
    browserMockSnapshot,
  );
  if (!browserNativeTest) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        height: 76,
        justifyContent: 'center',
        backgroundColor: '#fff3d8',
        borderBottomWidth: 1,
        borderBottomColor: '#c79439',
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#684414', fontSize: 9, fontWeight: '800' }}>
            MOCK · TESTE NO NAVEGADOR · API REAL
          </Text>
          <Text
            numberOfLines={3}
            accessibilityLiveRegion="polite"
            style={{
              color: '#684414',
              fontSize: 10,
              lineHeight: 14,
              marginTop: 3,
            }}
          >
            {action}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Simular notificacao no navegador"
          onPress={() =>
            reportBrowserMock(
              'Notificacao MOCK recebida no navegador. Nenhum push real foi enviado.',
            )
          }
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={18} color="#684414" />
        </Pressable>
      </View>
    </View>
  );
}
