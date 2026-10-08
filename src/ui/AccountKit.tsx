import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useRouter, useRootNavigationState, Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ChevronRight, Home, Route, MessageCircle, UserRound, Wallet, LucideIcon } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { Entrance, Feedback, Screen, type } from './Kit';
import { useZippyTheme } from './theme';

export function AppNav({ active = 'profile' }: { active?: 'home' | 'map' | 'chats' | 'profile' | 'earnings' }) {
  const router = useRouter(), { reducedMotion, dark } = useZippyTheme();
  const tabs: { id: typeof active; title: string; icon: LucideIcon; path: Href }[] = [
    { id: 'home', title: 'Início', icon: Home, path: '/' }, { id: 'map', title: 'Rota', icon: Route, path: '/rota' },
    { id: 'chats', title: 'Chat', icon: MessageCircle, path: '/conversas' },
    { id: 'profile', title: 'Perfil', icon: UserRound, path: '/perfil' },
  ];
  const items: ({ id:string; title:string; icon:LucideIcon; path?:Href })[]=[...tabs.slice(0,3),{id:'earnings',title:'Ganhos',icon:Wallet,path:'/ganhos'},tabs[3]];
  return <View style={{ height: 64, borderRadius: 21, backgroundColor: dark ? '#0e1b30' : '#16243d', borderWidth: dark ? 1 : 0, borderColor: '#40557655', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, boxShadow: '0 12px 28px #08162933' }}>{items.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.path?tab.title:'Ganhos — disponível na etapa 6'} accessibilityState={{ selected: active === tab.id, disabled:!tab.path }} disabled={!tab.path} onPress={() => tab.path && router.navigate(tab.path)} style={({ pressed }) => ({ flex:1, minHeight: 49, gap: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: active === tab.id ? '#82b5ff14' : 'transparent', opacity: pressed ? .65 : 1 })}>
    {active === tab.id && <View style={{ position: 'absolute', top: 1, width: 12, height: 2, borderRadius: 3, backgroundColor: '#7db0ff', boxShadow: reducedMotion ? undefined : '0 0 8px #7db0ff' }} />}
    <tab.icon size={19} color={active === tab.id ? '#9bc4ff' : '#8d9fba'} strokeWidth={1.8} /><Text style={{ fontFamily: 'Manrope', fontSize: 9, color: active === tab.id ? '#9bc4ff' : '#8d9fba' }}>{tab.title}</Text>
  </Pressable>)}</View>;
}

export function AccountScreen({ children, active = 'profile', footer }: { children: React.ReactNode; active?: 'home' | 'map' | 'chats' | 'profile' | 'earnings'; footer?: React.ReactNode }) {
  const auth = useAuth(), focused = useIsFocused(), router = useRouter(), navigation = useRootNavigationState();
  React.useEffect(() => { if (navigation?.key && focused && !auth.isLoading && !auth.user && !auth.restoreError) router.replace('/(auth)/login'); }, [navigation?.key, focused, auth.user, auth.isLoading, auth.restoreError, router]);
  if (!auth.user && auth.restoreError) return <Screen><Feedback title="Vamos reconectar seu acesso" message={auth.restoreError} onRetry={()=>void auth.loadUserFromStorage()}/></Screen>;
  if (auth.isLoading || !auth.user) return <Screen><Feedback title="Conferindo seu acesso" loading /></Screen>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Screen footer={<View style={{ gap: 12 }}>{footer}<AppNav active={active} /></View>}><Entrance>{children}</Entrance></Screen></KeyboardAvoidingView>;
}

export function AccountAvatar({ name, uri }: { name: string; uri?: string | null }) {
  const { colors } = useZippyTheme();
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  return <View style={{ width: 86, height: 86, borderRadius: 29, backgroundColor: colors.accentSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 24px #2a3e5915' }}>{uri && !failed ? <Image source={{ uri }} style={{ width: 86, height: 86 }} onError={() => setFailed(true)} /> : <Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 29, color: colors.accent }}>{name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?'}</Text>}</View>;
}

export function MenuRow({ title, subtitle, icon: Icon, onPress, right, last, disabled, danger }: { title: string; subtitle?: string; icon: LucideIcon; onPress?: () => void; right?: React.ReactNode; last?: boolean; disabled?: boolean; danger?: boolean }) {
  const { colors } = useZippyTheme();
  return <Pressable disabled={disabled || !onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 65, paddingVertical: 15, borderBottomWidth: last ? 0 : 1, borderColor: colors.line, opacity: pressed || disabled ? .65 : 1 })}>
    <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: danger ? colors.dangerSoft : colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={danger ? colors.danger : colors.accent} strokeWidth={1.8} /></View>
    <View style={{ flex: 1 }}><Text style={{ fontFamily: 'ManropeExtraBold', fontSize: 13, color: colors.ink }}>{title}</Text>{subtitle && <Text style={{ fontFamily: 'Manrope', fontSize: 10, lineHeight: 16, marginTop: 3, color: colors.muted }}>{subtitle}</Text>}</View>
    {right || (onPress && <ChevronRight size={15} color={colors.muted} />)}
  </Pressable>;
}

export function AccountNotice({ children, icon: Icon, warning }: { children: string; icon: LucideIcon; warning?: boolean }) {
  const { colors, dark } = useZippyTheme();
  const foreground=dark?warning?'#f2d2ab':'#c2d5ed':warning?colors.warning:colors.accent;
  return <View style={{ flexDirection: 'row', gap: 9, padding: 13, borderRadius: 13, backgroundColor: dark?warning?'#382f26':'#222f3f':warning?colors.warningSoft:colors.soft, borderWidth:dark?1:0,borderColor:warning?'#99734b66':'#546a8844', marginVertical: 12 }}><Icon size={16} color={foreground} /><Text style={[type.small, { flex: 1, color:foreground, fontSize: 10, lineHeight: 16 }]}>{children}</Text></View>;
}
