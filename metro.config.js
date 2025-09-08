const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configurações para resolver problemas de network
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configurações para melhorar a performance e resolver problemas de rede
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

module.exports = config;