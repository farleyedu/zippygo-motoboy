"use client";

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  MapPin,
  AlertTriangle,
  ArrowLeft,
  MessageCircle,
  Check,
  Clock,
  Settings,
  Edit3,
  DollarSign,
  QrCode,
  CreditCard,
  Phone,
  ChevronDown,
  FileText,
  Ban,
  Coffee,
  Utensils,
} from "lucide-react-native";

export default function EntregaNovaScreen() {
  const [metodoSelecionado, setMetodoSelecionado] =
    useState<null | "dinheiro" | "pix" | "debito" | "credito">(null);
  const [mostrarAvisoMetodo, setMostrarAvisoMetodo] = useState(false);
  const [mostrarAcoesTelefone, setMostrarAcoesTelefone] = useState(false);

  const handleCobrar = () => {
    if (!metodoSelecionado) {
      setMostrarAvisoMetodo(true);
      setTimeout(() => setMostrarAvisoMetodo(false), 2000);
      return;
    }
    // TODO: fluxo real de cobrança
  };

  const handleAcaoTelefone = (acao: "ligar" | "whatsapp") => {
    // Em RN puro, usar Linking; mantendo stub por enquanto
    // Linking.openURL("tel:+5511999999999") etc.
    setMostrarAcoesTelefone(false);
  };

  const Chip = ({
    ativo,
    onPress,
    icon,
    label,
    ringColor,
    bgLight,
    textColor,
    mr = 0,
  }: {
    ativo: boolean;
    onPress: () => void;
    icon: React.ReactNode;
    label: string;
    ringColor: string;
    bgLight: string;
    textColor: string;
    mr?: number;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { marginRight: mr },
        ativo
          ? {
              borderWidth: 2,
              borderColor: ringColor,
              backgroundColor: bgLight,
            }
          : styles.chipOff,
      ]}
      activeOpacity={0.8}
    >
      <View style={styles.rowCenter}>
        {icon}
        <Text
          style={[
            styles.chipText,
            ativo ? { color: textColor } : { color: "#374151" },
          ]}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <ArrowLeft size={24} color="#374151" />
        <Text style={styles.headerTitle}>ENTREGA</Text>
        <MessageCircle size={24} color="#374151" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Card Endereço */}
        <View style={styles.cardOuter}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row" }}>
              <View style={styles.pinCircle}>
                <MapPin size={16} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.addrTitle}>Rua das Flores, 1234</Text>
                <Text style={styles.addrSub}>Vila Madalena - São Paulo, SP</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.mapBtn}
              activeOpacity={0.85}
              // onPress={() => {}}
            >
              <View style={styles.mapDotBox}>
                <View style={styles.mapDot} />
              </View>
              <Text style={styles.mapBtnText}>Mapa</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alerta */}
        <View style={styles.alertRow}>
          <AlertTriangle size={12} color="#B45309" />
          <Text style={styles.alertText}>Solicite o código de entrega</Text>
        </View>

        {/* Card principal */}
        <View style={styles.cardOuter}>
          {/* Header restaurante */}
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.clientName}>Maria Silva</Text>
              <Text style={styles.ifoodTag}>iFood</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>MS</Text>
            </View>
          </View>

          {/* ID e Itens */}
          <View style={[styles.rowBetween, { marginBottom: 12 }]}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>ID do Pedido</Text>
              <Text style={styles.infoValue}>#12345678</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Itens</Text>
              <Text style={styles.infoValue}>3 itens</Text>
            </View>
          </View>

          {/* Status */}
          <View style={[styles.row, { marginBottom: 12 }]}>
            <View style={[styles.pill, styles.pillGreen]}>
              <Check size={12} color="#166534" />
              <Text style={styles.pillTxtGreen}>Validado</Text>
            </View>
            <View style={[styles.pill, styles.pillRed]}>
              <Clock size={12} color="#991B1B" />
              <Text style={styles.pillTxtRed}>Cobrar</Text>
            </View>
          </View>

          {/* Código confirmado */}
          <View style={styles.codeOk}>
            <Settings size={16} color="#16A34A" />
            <Text style={styles.codeOkTxt}>Código confirmado</Text>
          </View>

          {/* Valor + título seção */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Text style={styles.totalValue}>R$ 20,00</Text>
            <Text style={styles.totalCaption}>Valor a cobrar</Text>
            <Text style={styles.payMethodTitle}>Método de Pagamento</Text>
          </View>

          {/* Chips (4 colunas, alinhados à largura do botão) */}
          <View style={styles.chipsRow}>
            <Chip
              ativo={metodoSelecionado === "dinheiro"}
              onPress={() => setMetodoSelecionado("dinheiro")}
              icon={<DollarSign size={14} color="#22c55e" />}
              label="Dinheiro"
              ringColor="#22c55e"
              bgLight="#ECFDF5"
              textColor="#166534"
              mr={8}
            />

            <Chip
              ativo={metodoSelecionado === "pix"}
              onPress={() => setMetodoSelecionado("pix")}
              icon={<QrCode size={14} color="#06b6d4" />}
              label="PIX"
              ringColor="#06b6d4"
              bgLight="#ECFEFF"
              textColor="#0E7490"
              mr={8}
            />

            <Chip
              ativo={metodoSelecionado === "debito"}
              onPress={() => setMetodoSelecionado("debito")}
              icon={<CreditCard size={14} color="#a855f7" />}
              label="Débito"
              ringColor="#a855f7"
              bgLight="#FAF5FF"
              textColor="#6B21A8"
              mr={8}
            />

            <Chip
              ativo={metodoSelecionado === "credito"}
              onPress={() => setMetodoSelecionado("credito")}
              icon={<CreditCard size={14} color="#f97316" />}
              label="Crédito"
              ringColor="#f97316"
              bgLight="#FFF7ED"
              textColor="#9A3412"
            />
          </View>

          {mostrarAvisoMetodo && (
            <Text style={styles.warnSelect}>Selecione um método de pagamento para continuar.</Text>
          )}

          {/* Botão COBRAR */}
          <TouchableOpacity
            onPress={handleCobrar}
            activeOpacity={0.85}
            style={[
              styles.primaryBtn,
              !metodoSelecionado && { backgroundColor: "#E5E7EB" },
            ]}
            disabled={!metodoSelecionado}
          >
            <Edit3 size={18} color={metodoSelecionado ? "#fff" : "#6B7280"} />
            <Text
              style={[
                styles.primaryBtnTxt,
                !metodoSelecionado && { color: "#6B7280" },
              ]}
            >
              Cobrar R$ 20,00
            </Text>
          </TouchableOpacity>
        </View>

        {/* Itens do Pedido */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Itens do Pedido</Text>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.itemIcon}>
                <Utensils size={16} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.itemTitle}>Big Mac</Text>
                <Text style={styles.itemSub}>Quantidade: 1</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>R$ 18,90</Text>
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.itemIcon}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#9CA3AF" }} />
              </View>
              <View>
                <Text style={styles.itemTitle}>Batata Frita Média</Text>
                <Text style={styles.itemSub}>Quantidade: 1</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>R$ 12,90</Text>
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.itemIcon}>
                <Coffee size={16} color="#6b7280" />
              </View>
              <View>
                <Text style={styles.itemTitle}>Coca-Cola 500ml</Text>
                <Text style={styles.itemSub}>Quantidade: 1</Text>
              </View>
            </View>
            <Text style={styles.itemPrice}>R$ 8,90</Text>
          </View>
        </View>

        {/* Linha do Tempo */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Linha do Tempo</Text>

          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: "#22C55E" }]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>Pedido coletado</Text>
              <Text style={styles.timelineSub}>14:15 - McDonald's Vila Madalena</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: "#22C55E" }]}>
              <Check size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>A caminho do cliente</Text>
              <Text style={styles.timelineSub}>14:25 - Saiu para entrega</Text>
            </View>
          </View>

          <View style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: "#3B82F6" }]}>
              <MapPin size={14} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>No local de entrega</Text>
              <Text style={styles.timelineSub}>14:35 - Aguardando confirmação</Text>
            </View>
          </View>
        </View>

        {/* Informações do Cliente */}
        <View style={styles.cardOuter}>
          <Text style={styles.sectionTitle}>Informações do Cliente</Text>

          {/* Telefone */}
          <View style={{ position: "relative" }}>
            <TouchableOpacity
              onPress={() => setMostrarAcoesTelefone((v) => !v)}
              style={styles.phoneBtn}
              activeOpacity={0.9}
            >
              <View style={styles.itemLeft}>
                <View style={styles.phoneIcon}>
                  <Phone size={16} color="#3B82F6" />
                </View>
                <View>
                  <Text style={styles.phoneTitle}>(11) 99999-9999</Text>
                  <Text style={styles.phoneSub}>Toque para escolher ação</Text>
                </View>
              </View>
              <ChevronDown
                size={16}
                color="#9CA3AF"
                style={{ transform: [{ rotate: mostrarAcoesTelefone ? "180deg" : "0deg" }] }}
              />
            </TouchableOpacity>

            {mostrarAcoesTelefone && (
              <View style={styles.phoneMenu}>
                <TouchableOpacity onPress={() => handleAcaoTelefone("ligar")} style={styles.menuRow}>
                  <Phone size={16} color="#22C55E" />
                  <Text style={styles.menuTxt}>Ligar</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />
                <TouchableOpacity onPress={() => handleAcaoTelefone("whatsapp")} style={styles.menuRow}>
                  <MessageCircle size={16} color="#22C55E" />
                  <Text style={styles.menuTxt}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Observações */}
          <View style={styles.obsRow}>
            <View style={styles.obsIcon}>
              <FileText size={16} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.obsLabel}>Observações</Text>
              <Text style={styles.obsText}>
                Apartamento 302, interfone não funciona. Favor ligar quando chegar.
              </Text>
            </View>
          </View>

          {/* Ações secundárias */}
          <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
            <TouchableOpacity activeOpacity={0.9} style={[styles.secondaryBtn, { backgroundColor: "#F97316" }]}>
              <AlertTriangle size={18} color="#fff" />
              <Text style={styles.secondaryTxt}>Reportar Problema</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} style={[styles.secondaryBtn, { backgroundColor: "#4B5563" }]}>
              <Ban size={18} color="#fff" />
              <Text style={styles.secondaryTxt}>Cancelar Entrega</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Barra fixa inferior */}
      <View style={styles.bottomBar}>
        <View style={{ alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#F97316" }}>Aguardando pagamento</Text>
          <Text style={{ fontSize: 12, color: "#4B5563" }}>Complete o pagamento para continuar</Text>
        </View>

        <TouchableOpacity activeOpacity={1} style={[styles.primaryBtn, { backgroundColor: "#9CA3AF" }]}>
          <View style={styles.squareIcon}>
            <View style={styles.squareDot} />
          </View>
          <Text style={[styles.primaryBtnTxt]}>Próxima Entrega</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  cardOuter: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center" },
  rowCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center" },

  pinCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 12 },
  addrTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addrSub: { fontSize: 14, color: "#4B5563", marginTop: 2 },

  mapBtn: { backgroundColor: "#3B82F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: "row", alignItems: "center" },
  mapDotBox: { width: 16, height: 16, backgroundColor: "#fff", borderRadius: 4, alignItems: "center", justifyContent: "center", marginRight: 6 },
  mapDot: { width: 8, height: 8, backgroundColor: "#3B82F6", borderRadius: 2 },
  mapBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  alertRow: {
    marginHorizontal: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  alertText: { marginLeft: 6, color: "#92400E", fontSize: 13, fontWeight: "600" },

  clientName: { fontSize: 18, fontWeight: "700", color: "#111827", marginRight: 8 },
  ifoodTag: { backgroundColor: "#EF4444", color: "#fff", fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: "700" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontWeight: "800", color: "#374151" },

  infoBox: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E5E7EB" },
  infoLabel: { fontSize: 10, color: "#9CA3AF", textTransform: "uppercase" },
  infoValue: { fontSize: 12, fontWeight: "700", color: "#1F2937", marginTop: 2 },

  pill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginRight: 8 },
  pillGreen: { backgroundColor: "#DCFCE7" },
  pillRed: { backgroundColor: "#FEE2E2" },
  pillTxtGreen: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#166534" },
  pillTxtRed: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#991B1B" },

  codeOk: { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0", borderWidth: 1, padding: 10, borderRadius: 8, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  codeOkTxt: { marginLeft: 8, color: "#15803D", fontSize: 14, fontWeight: "600" },

  totalValue: { fontSize: 22, fontWeight: "800", color: "#EF4444", marginBottom: 2 },
  totalCaption: { fontSize: 13, color: "#4B5563", marginBottom: 8 },
  payMethodTitle: { fontSize: 14, color: "#111827", fontWeight: "700" },

  chipsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  chip: { flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff", alignItems: "center" },
  chipOff: { backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: "600", marginLeft: 6 },

  warnSelect: { marginTop: 6, marginBottom: 8, fontSize: 12, color: "#DC2626" },

  primaryBtn: { marginTop: 6, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  primaryBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800", marginLeft: 8 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },

  itemRow: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  itemSub: { fontSize: 12, color: "#4B5563" },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#111827" },

  timelineRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  timelineTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  timelineSub: { fontSize: 12, color: "#2563EB" },

  phoneBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#F9FAFB", borderRadius: 10 },
  phoneIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 12 },
  phoneTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  phoneSub: { fontSize: 12, color: "#4B5563" },

  phoneMenu: { position: "absolute", top: 48, left: 0, right: 0, backgroundColor: "#fff", borderColor: "#E5E7EB", borderWidth: 1, borderRadius: 10, overflow: "hidden", elevation: 3 },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  menuTxt: { marginLeft: 8, fontSize: 14, color: "#111827" },

  obsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginTop: 12 },
  obsIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFEDD5", alignItems: "center", justifyContent: "center", marginRight: 12 },
  obsLabel: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  obsText: { fontSize: 14, color: "#111827" },

  secondaryBtn: { width: "100%", height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  secondaryTxt: { color: "#fff", fontSize: 16, fontWeight: "700", marginLeft: 8 },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, alignSelf: "center", width: "100%", maxWidth: 480, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 12 },
  squareIcon: { width: 16, height: 16, backgroundColor: "#9CA3AF", borderRadius: 4, alignItems: "center", justifyContent: "center", marginRight: 8 },
  squareDot: { width: 8, height: 8, backgroundColor: "#fff", borderRadius: 2 },
});
