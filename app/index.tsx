import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import TelaInicialMap from '../components/TelaInicialMap';
import 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Index() {
  const jaInicializado = useRef(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (jaInicializado.current) return;
    jaInicializado.current = true;

    // 🔔 Configura handler para notificações recebidas
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const configurarNotificacoes = async () => {
      // 1. Solicita permissão de notificação (obrigatório no Android 13+)
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[ZIPPY] Notificações não permitidas');
      }

      // 2. Cria canal com antecedência
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ZippyGo Notificações',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2C79FF',
      });
    };

    configurarNotificacoes();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <TelaInicialMap />

      {/* Botão flutuante para abrir a tela de exemplo da sacola (demo) */}

    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    // bottom calculado via insets
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 16, // aumenta para garantir estar acima no Android
    zIndex: 9999, // garante estar acima de overlays com zIndex alto
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fabText: {
    color: '#fff',
    fontWeight: '700',
  },
});
