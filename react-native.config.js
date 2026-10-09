module.exports = {
  dependencies: {
    // Android usa o mapa do Navigation SDK. Expo Go mantém o módulo embutido;
    // iOS ainda pode usar Apple Maps nas telas sem navegação.
    'react-native-maps': { platforms: { android: null } },
  },
};
