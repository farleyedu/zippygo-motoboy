import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  chatAttachmentData,
  LocalChatFile,
} from '../../services/communicationApi';
import { createIdentifier } from '../../services/mobileApi';

function extension(contentType: string): string {
  const type = contentType.split(';')[0].toLowerCase();
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };
  if (!extensions[type]) throw new Error('Formato do anexo não suportado.');
  return extensions[type];
}

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
  const uri = `${dir}${createIdentifier()}.${extension(file.contentType)}`;
  await FileSystem.copyAsync({ from: file.uri, to: uri });
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && info.size > 10485760) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    throw new Error('Arquivo deve ter ate 10 MB.');
  }
  return { ...file, uri };
}
export async function openChatFile(
  id: string,
  clientPedidoId?: number,
): Promise<string> {
  const data = await chatAttachmentData(id, clientPedidoId);
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(data);
  if (!match || !/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Anexo inválido.');
  const ext = extension(match[1]);
  if (Platform.OS === 'web') return data;
  const uri = `${FileSystem.cacheDirectory}chat-${id}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, match[2], {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}
