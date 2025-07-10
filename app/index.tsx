import React, { useEffect, useRef } from 'react';
import TelaInicialMap from '../components/TelaInicialMap';
import 'react-native-gesture-handler';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import '../components/locationTask';

const LOCATION_TASK_NAME = 'background-location-task';

export default function Index() {
  const jaInicializado = useRef(false);

  useEffect(() => {
    if (jaInicializado.current) return;
    jaInicializado.current = true;

    const iniciarMonitoramento = async () => {
      console.log('[ZIPPY] Solicitando permissões...');

      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      console.log('[ZIPPY2] Solicitando permissões...');

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log('[ZIPPY3] Solicitando permissões...');

      const fgGranted = fgStatus === 'granted';
      const bgGranted = bgStatus === 'granted';

      if (fgGranted && bgGranted) {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (!isRegistered) {
          console.log('[ZIPPY] Iniciando rastreamento de localização...');

          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 5000,
            distanceInterval: 1,
            pausesUpdatesAutomatically: false,
            deferredUpdatesDistance: 0,
            deferredUpdatesInterval: 0,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'ZippyGo',
              notificationBody: 'Rastreamento ativo',
              notificationColor: '#2C79FF',
            },
          });

          console.log('[ZIPPY] startLocationUpdatesAsync registrado!');
        } else {
          console.log('[ZIPPY] Task já registrada.');
        }
      } else {
        console.warn('[ZIPPY] Permissões não concedidas.');
      }
    };

    iniciarMonitoramento();
  }, []);

  return <TelaInicialMap />;
}
