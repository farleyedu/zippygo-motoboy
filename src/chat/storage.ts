import AsyncStorage from '@react-native-async-storage/async-storage';
const writes = new Map<string, Promise<void>>();
export async function readChatStorage(key: string) {
  await writes.get(key)?.catch(() => undefined);
  return AsyncStorage.getItem(key);
}
export function writeChatStorage(key: string, value: string) {
  const pending = (writes.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(key, value));
  writes.set(key, pending);
  void pending
    .finally(() => {
      if (writes.get(key) === pending) writes.delete(key);
    })
    .catch(() => undefined);
  return pending;
}
