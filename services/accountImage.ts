import { Platform } from 'react-native';
import { browserNativeTest, createBrowserMockPhoto } from './browserNativeTest';

export async function chooseAccountImage(camera: boolean): Promise<string | null> {
  if (camera && browserNativeTest) return createBrowserMockPhoto();
  // Carregamento por ação: aparelhos com binário antigo continuam abrindo o app.
  const picker = await import('expo-image-picker');
  if (camera) {
    const permission = await picker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Permita o acesso à câmera nas configurações do aparelho para tirar a foto.');
  } else if (Platform.OS !== 'web') {
    const permission = await picker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Permita o acesso às fotos nas configurações do aparelho.');
  }
  const options = { mediaTypes: ['images'] as ('images')[], base64: true, quality: .75, allowsEditing: false };
  const result = camera ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 4 * 1024 * 1024 || !asset.base64 || asset.base64.length > 5_600_000) throw new Error('Escolha uma foto JPG ou PNG de até 4 MB.');
  return asset.base64;
}
