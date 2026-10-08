import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  chatAttachmentData,
  LocalChatFile,
} from '../../services/communicationApi';
import { createIdentifier } from '../../services/mobileApi';

export async function retainChatFile(
  file: LocalChatFile,
): Promise<LocalChatFile> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    if (blob.size > 10485760) throw new Error('Arquivo deve ter ate 10 MB.');
    const uri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    return { ...file, uri };
  }
  const dir = `${FileSystem.documentDirectory}chat-outbox/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const uri = `${dir}${createIdentifier()}.${file.contentType.startsWith('image/') ? 'jpg' : 'm4a'}`;
  await FileSystem.copyAsync({ from: file.uri, to: uri });
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && info.size > 10485760) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    throw new Error('Arquivo deve ter ate 10 MB.');
  }
  return { ...file, uri };
}
export async function openChatFile(id: string): Promise<string> {
  const data = await chatAttachmentData(id);
  if (Platform.OS === 'web') return data;
  const uri = `${FileSystem.cacheDirectory}chat-${id}.${data.startsWith('data:image/') ? 'jpg' : 'm4a'}`;
  await FileSystem.writeAsStringAsync(uri, data.slice(data.indexOf(',') + 1), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}
