import AsyncStorage from '@react-native-async-storage/async-storage';
export type NavigatorChoice = 'ZippyGo' | 'Google Maps' | 'Waze' | 'map';
const key = 'zippygo.navigation.choice.v1';
export async function saveNavigatorChoice(sessionId: string | undefined, navigator: NavigatorChoice): Promise<void> {
  if (sessionId) await AsyncStorage.setItem(key, JSON.stringify({ sessionId, navigator }));
}
export async function readNavigatorChoice(sessionId: string): Promise<NavigatorChoice | null> {
  try { const raw = await AsyncStorage.getItem(key), value = raw ? JSON.parse(raw) : null; return value?.sessionId === sessionId && ['ZippyGo', 'Google Maps', 'Waze', 'map'].includes(value.navigator) ? value.navigator : null; }
  catch { return null; }
}
