module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Deve ser o último plugin
      'react-native-reanimated/plugin',
    ],
  };
};
