import React, { useCallback, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, useBottomSheet } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

// Tela de demonstração do comportamento de Sacola (iFood-like)
// Requisitos atendidos:
// - @gorhom/bottom-sheet v4+ (usando v5.x) com nested scrolling via BottomSheetScrollView
// - enableContentPanningGesture para permitir arrastar em qualquer área do conteúdo
// - enablePanDownToClose desabilitado para evitar fechamentos acidentais
// - Snap points responsivos: ['100%', '70%', '35%']
// - Backdrop animado com animatedIndex (appearsOnIndex={1}, disappearsOnIndex={0})
// - Animação sutil no cabeçalho: altura/sombra variando conforme o índice
// - TestIDs adicionados
// - keyboardBehavior="interactive" no iOS para testar input no topo

export default function ExemploSacolaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const sheetRef = useRef<React.ElementRef<typeof BottomSheet>>(null);
  const snapPoints = useMemo(() => ['100%', '70%', '35%'], []);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={1}
      disappearsOnIndex={0}
      pressBehavior="none"
    />
  ), []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableContentPanningGesture={true}
        enablePanDownToClose={false}
        keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'extend'}
        bottomInset={Math.max(insets.bottom, 0)}
        backdropComponent={renderBackdrop}
        handleComponent={() => null}
        style={styles.sheet}
      >
        <SacolaHeader onClose={() => router.back()} />

        <BottomSheetScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
          showsVerticalScrollIndicator
          testID="sacola-scroll"
        >
          {/* Input no topo para testar keyboardBehavior */}
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Cupom de desconto"
              placeholderTextColor="#9CA3AF"
              style={styles.couponInput}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Aplicar</Text>
            </TouchableOpacity>
          </View>

          {/* Resumo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo</Text>
            <Text style={styles.line}>Entrega em: Rua Fictícia, 123 - Centro</Text>
            <Text style={styles.line}>Tempo estimado: 35 - 45 min</Text>
            <Text style={styles.line}>Pagamento: Cartão de crédito</Text>
          </View>

          {/* Lista mock de itens (20-30 itens) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Itens</Text>
            {Array.from({ length: 25 }).map((_, i) => (
              <View style={styles.itemCard} key={`item-${i}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>Item #{i + 1} - Sanduíche</Text>
                  <Text style={styles.itemQty}>Qtd: {1 + (i % 3)}</Text>
                </View>
                <Text style={styles.itemPrice}>R$ {(12.9 + i).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Bloco de texto longo para garantir rolagem */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.longText}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor,
              dignissim sit amet, adipiscing nec, ultricies sed, dolor. Cras elementum ultrices diam. Maecenas
              ligula massa, varius a, semper congue, euismod non, mi. Proin porttitor, orci nec nonummy molestie,
              enim est eleifend mi, non fermentum diam nisl sit amet erat. Duis semper. Duis arcu massa, scelerisque
              vitae, consequat in, pretium a, enim. Pellentesque congue. Ut in risus volutpat libero pharetra tempor.
              Cras vestibulum bibendum augue. Praesent egestas leo in pede. Praesent blandit odio eu enim. Pellentesque
              sed dui ut augue blandit sodales. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices
              posuere cubilia curae; Aliquam nibh. Mauris ac mauris sed pede pellentesque fermentum. Maecenas
              adipiscing ante non diam sodales hendrerit.
            </Text>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Dicas rápidas de uso durante o teste */}
      <View pointerEvents="none" style={[styles.hintOverlay, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.hintText}>
          Arraste para cima/baixo em qualquer área do conteúdo. Primeiro rola a lista, depois o sheet colapsa/expande.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    // Mantém suave e performático; a lib usa Reanimated/GH sob o capô
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  subtotalPill: {
    marginLeft: 10,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subtotalText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  closeBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  couponInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
    color: '#111827',
  },
  applyBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  line: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 10,
  },
  itemName: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  itemQty: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
    marginLeft: 8,
  },
  longText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  hintOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(17,24,39,0.7)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
  },
});


function SacolaHeader({ onClose }: { onClose: () => void }) {
  const { animatedIndex } = useBottomSheet();
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const idx = animatedIndex.value ?? 0;
    return {
      height: interpolate(idx, [0, 2], [72, 56], Extrapolation.CLAMP),
      shadowOpacity: interpolate(idx, [0, 2], [0.18, 0.06], Extrapolation.CLAMP),
      elevation: interpolate(idx, [0, 2], [6, 1], Extrapolation.CLAMP),
    };
  });
  return (
    <Animated.View style={[styles.header, headerAnimatedStyle]}>
      <View style={styles.grabber} />
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Sacola (demo)</Text>
        <View style={styles.subtotalPill}>
          <Text style={styles.subtotalText}>Subtotal R$ 89,90</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Fechar sacola"
          testID="btn-fechar-sacola"
          onPress={onClose}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}