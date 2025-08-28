import React, { useEffect, useRef } from 'react';
import TelaInicialMap from '../components/TelaInicialMap';
import 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

export default function Index() {
  const jaInicializado = useRef(false);

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

  return <TelaInicialMap />;
}
