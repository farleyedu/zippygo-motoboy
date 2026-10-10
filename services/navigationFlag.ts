// Liga/desliga o Google Navigation SDK (navegação dentro do app, cobrada por destino).
// Desligado: o mapa continua no app, mas "navegar" abre o Google Maps/Waze, sem custo.
// Para desligar, defina EXPO_PUBLIC_NAVIGATION_SDK_ENABLED=false no .env e gere um novo build.
export const navigationSdkEnabled = process.env.EXPO_PUBLIC_NAVIGATION_SDK_ENABLED !== 'false';
