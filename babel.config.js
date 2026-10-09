module.exports = function (api) {
  api.cache(true);
  return {
    // O babel-preset-expo ja configura o plugin de worklets do Reanimated 4.
    presets: ['babel-preset-expo'],
  };
};
