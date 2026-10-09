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
  const options = { mediaTypes: ['images'] as ('images')[], base64: false, quality: 1, allowsEditing: false,
    // iOS: desde o expo-image-picker 17 o padrao manteria HEIC; a API espera JPG/PNG.
    preferredAssetRepresentationMode: picker.UIImagePickerPreferredAssetRepresentationMode.Automatic };
  const result = camera ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  const manipulator = await import('expo-image-manipulator');
  const resize = asset.width > 1800 || asset.height > 1800 ? [{ resize: asset.width >= asset.height ? { width: 1800 } : { height: 1800 } }] : [];
  const image = await manipulator.manipulateAsync(asset.uri, resize, { compress: .78, format: manipulator.SaveFormat.JPEG, base64: true });
  if (!image.base64 || image.base64.length > 5_600_000) throw new Error('Não foi possível preparar a foto. Escolha uma imagem menor.');
  return image.base64;
}
