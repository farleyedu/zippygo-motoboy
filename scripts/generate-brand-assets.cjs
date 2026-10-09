// A arte original foi criada com imagegen. Este script apenas dimensiona e
// compõe os recursos de plataforma usando os mesmos geradores do Expo.
const fs = require('node:fs/promises');
const path = require('node:path');
const { getConfig } = require('expo/config');
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
  getPngInfo,
} = require('@expo/image-utils');
const {
  getIcon,
  getAdaptiveIcon,
  setIconAsync,
} = require('@expo/prebuild-config/build/plugins/icons/withAndroidIcons');
const splashPluginRoot = path.dirname(require.resolve('expo-splash-screen/plugin'));
const {
  getAndroidSplashConfig,
} = require(path.join(splashPluginRoot, 'getAndroidSplashConfig.js'));
const {
  setSplashImageDrawablesForThemeAsync,
} = require(path.join(splashPluginRoot, 'withAndroidSplashImages.js'));

const projectRoot = path.resolve(__dirname, '..');

async function resized(src, size) {
  return (await generateImageAsync(
    { projectRoot, cacheType: 'zippygo-brand' },
    { src, width: size, height: size, resizeMode: 'contain' },
  )).source;
}

async function centered(src, size, backgroundColor) {
  const background = await generateImageBackgroundAsync({
    width: 1024, height: 1024, backgroundColor, resizeMode: 'contain',
  });
  const foreground = await resized(src, size);
  return compositeImagesAsync({
    background, foreground, x: (1024 - size) / 2, y: (1024 - size) / 2,
  });
}

async function main() {
  const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true });
  const plugin = exp.plugins.find((entry) =>
    Array.isArray(entry) && entry[0] === 'expo-splash-screen');
  if (!plugin?.[1]?.image || !exp.android?.adaptiveIcon?.foregroundImage) {
    throw new Error('Configure a arte de abertura e o ícone adaptativo no Expo.');
  }
  const master = path.resolve(projectRoot, plugin[1].image);
  const info = await getPngInfo(master);
  if (info.width !== info.height || info.bpp !== 4 ||
      !info.data.some((value, index) => index % 4 === 3 && value === 0)) {
    throw new Error('A arte-mestra precisa ser um PNG quadrado com transparência real.');
  }
  const iconPath = path.resolve(projectRoot, getIcon(exp));
  const adaptive = getAdaptiveIcon(exp);
  await fs.writeFile(iconPath, await centered(master, 780, adaptive.backgroundColor));
  // O compositor Jimp pode deixar alpha 254 em alguns pixels de borda.
  // A exportação RGB garante um ícone sem transparência para instalação/iOS.
  const opaqueIcon = await generateImageAsync(
    { projectRoot, cacheType: 'zippygo-brand-opaque' },
    { src: iconPath, width: 1024, height: 1024, resizeMode: 'contain',
      backgroundColor: adaptive.backgroundColor, removeTransparency: true },
  );
  await fs.writeFile(iconPath, opaqueIcon.source);
  // Área segura circular: 66 dp dentro do canvas adaptativo de 108 dp.
  await fs.writeFile(path.resolve(projectRoot, adaptive.foregroundImage),
    await centered(master, 528, 'transparent'));
  await fs.writeFile(path.resolve(projectRoot, exp.web.favicon), await resized(iconPath, 64));

  const androidPath = path.join(projectRoot, 'android/app/src/main/res');
  try {
    await fs.access(androidPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log('Assets Expo gerados. Os recursos nativos serão gerados pelo prebuild.');
    return;
  }
  // Atualiza somente ícones/abertura, preservando Gradle e a navegação nativa.
  await setIconAsync(projectRoot, { icon: getIcon(exp), ...adaptive, isAdaptive: true });
  const splash = getAndroidSplashConfig(plugin[1]);
  await setSplashImageDrawablesForThemeAsync(splash, 'light', projectRoot, splash.imageWidth);
  const colorsPath = path.join(androidPath, 'values/colors.xml');
  let colors = await fs.readFile(colorsPath, 'utf8');
  for (const [name, value] of [
    ['iconBackground', adaptive.backgroundColor],
    ['splashscreen_background', splash.backgroundColor],
  ]) {
    const pattern = new RegExp(`(<color name="${name}">)[^<]*(</color>)`);
    if (!pattern.test(colors)) throw new Error(`Cor Android ausente: ${name}`);
    colors = colors.replace(pattern, `$1${value}$2`);
  }
  await fs.writeFile(colorsPath, colors);
  console.log('ZippyGo: ícone, favicon, foreground e 20 recursos Android gerados da mesma arte.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
