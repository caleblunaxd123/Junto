import React from "react";
import {
  View,
  Pressable,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppDialog as Alert } from "../../../src/components/ui/AppDialog";
import { router } from "expo-router";
import { useAuthStore } from "../../../src/store/auth.store";
import {
  Screen,
  Card,
  Label,
  Avatar,
  palette,
  design,
} from "../../../src/components/ui/Design";
import { IconBubble } from "../../../src/components/ui/Reference";
import Constants from "expo-constants";
function Row({
  icon,
  title,
  subtitle,
  color = palette.purple,
  bg = palette.lilac,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color?: string;
  bg?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[design.row, { paddingVertical: 10, gap: 10 }]}
    >
      <IconBubble name={icon} size={36} color={color} background={bg} />
      <View style={{ flex: 1 }}>
        <Label
          weight="bold"
          size={13}
          color={title === "Cerrar sesión" ? palette.coral : palette.ink}
        >
          {title}
        </Label>
        <Label size={11} color={palette.muted}>
          {subtitle}
        </Label>
      </View>
      <Ionicons name="chevron-forward" size={17} color={palette.muted} />
    </Pressable>
  );
}
export default function Profile() {
  const { usuario, logout } = useAuthStore();
  const show = (title: string, body: string) => Alert.alert(title, body);
  const openPublic = async (url: string | undefined, title: string) => {
    if (!url?.startsWith("https://")) { show(title, "Esta página todavía no está publicada en esta versión de pruebas."); return; }
    try { await Linking.openURL(url); } catch { show(title, "No pudimos abrir el enlace. Revisa tu conexión y vuelve a intentarlo."); }
  };
  function exit() {
    Alert.alert(
      "¿Cerrar sesión?",
      "Tus grupos y gastos seguirán guardados en tu cuenta.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  }
  return (
    <Screen title="Perfil">
      <Card style={{ flexDirection: "row", alignItems: "center", padding: 15 }}>
        <Avatar
          name={usuario?.nombre || "Tú"}
          photo={usuario?.fotoUrl}
          seed={usuario?.id}
          size={72}
        />
        <View style={{ flex: 1, gap: 5 }}>
          <Label size={20} weight="extra">
            {usuario?.nombre}
          </Label>
          <Label size={11} color={palette.muted}>
            {usuario?.email}
          </Label>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(app)/perfil/editar")}
            style={{
              alignSelf: "flex-start",
              backgroundColor: palette.mint,
              padding: 8,
              borderRadius: 20,
            }}
          >
            <Label size={12} color="#078B70" weight="bold">
              ✎ Editar perfil
            </Label>
          </Pressable>
        </View>
      </Card>
      <Card style={{ padding: 12, gap: 0 }}>
        <Label weight="extra" size={14}>Ayuda</Label>
        <Row
          icon="help-circle-outline"
          title="¿Cómo funciona JUNTO?"
          subtitle="Cuentas de un día, grupos y pagos"
          color="#398BE5"
          bg="#E7F4FF"
          onPress={() =>
            show(
              "¿Cómo funciona JUNTO?",
              "Para una salida: toca «+» en Inicio → Una cuenta de hoy. Escribe el total o revisa la lectura de una boleta, añade personas y marca a los invitados. Revisa y guarda el reparto. Comparte el mensaje o la imagen; tú confirmas los aportes recibidos, incluso parciales. No necesitan registrarse.\n\nPara gastos continuos: «+» → Un grupo nuevo. Invita a quienes comparten contigo, registra quién pagó y para quién fue. Tus cuentas explicadas muestra cada cálculo. Un pago externo reduce la deuda solo cuando el receptor confirma.\n\nLas cuentas puntuales y las deudas de grupos no se mezclan. JUNTO no guarda ni transfiere dinero.",
            )
          }
        />
        <Row icon="chatbubble-outline" title="Ver un ejemplo" subtitle="Cena de S/ 120 y taxi de S/ 60" color={palette.primary} bg={palette.mint} onPress={() => router.push("/(app)/ejemplo")} />
        <Row icon="sparkles-outline" title="Preguntar al asistente" subtitle="Quién debe a quién, en palabras simples" onPress={() => router.push("/(app)/asistente")} />
        <Row icon="mail-outline" title="Contactar soporte" subtitle="Te respondemos por correo" color="#398BE5" bg="#E7F4FF" onPress={async () => {
          const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
          if (!email) { show("Soporte", "El correo de soporte aún no está configurado en esta versión de pruebas."); return; }
          try { await Linking.openURL(`mailto:${email}?subject=${encodeURIComponent("Ayuda con JUNTO")}`); } catch { show("Contactar soporte", `Escríbenos a ${email}. No incluyas contraseñas ni códigos.`); }
        }} />
      </Card>
      <Card style={{ padding: 12, gap: 0 }}>
        <Label weight="extra" size={14}>Cuenta y privacidad</Label>
        <Row
          icon="notifications-outline"
          title="Notificaciones"
          subtitle="Pagos por confirmar y recordatorios"
          color="#DB9700"
          bg={palette.yellow}
          onPress={() =>
            Alert.alert(
              "Notificaciones",
              "Te avisamos cuando alguien dice que te pagó o te recuerda un pago. Puedes cambiar el permiso en los ajustes del teléfono.",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
              ],
            )
          }
        />
        <Row
          icon="shield-checkmark-outline"
          title="Seguridad"
          subtitle="Correo verificado y buenas prácticas"
          onPress={() => show("Protege tu cuenta", `Tu correo ${usuario?.emailVerificado ? "está verificado" : "aún no está verificado"}.\n\nNunca compartas contraseñas ni códigos de correo. JUNTO no pide claves bancarias ni mueve dinero. Los pagos externos requieren confirmación del receptor.\n\nPara recuperar tu contraseña, utiliza “¿Olvidaste tu contraseña?” en la pantalla de inicio de sesión.`)}
        />
        <Row icon="document-text-outline" title="Política de privacidad" subtitle="Qué datos usamos y para qué" onPress={() => openPublic(process.env.EXPO_PUBLIC_PRIVACY_URL, "Política de privacidad")} />
        <Row icon="trash-outline" title="Eliminar mi cuenta" subtitle="Borra tus datos personales de forma permanente" color={palette.coral} bg={palette.blush} onPress={() => router.push("/(app)/perfil/eliminar")} />
      </Card>
      <Card style={{ padding: 12, gap: 0 }}>
        <Row
          icon="log-out-outline"
          title="Cerrar sesión"
          subtitle="Tus datos quedan guardados en tu cuenta"
          color={palette.coral}
          bg={palette.blush}
          onPress={exit}
        />
      </Card>
      <Label size={12} color={palette.muted} style={{ textAlign: "center" }}>
        JUNTO {Constants.expoConfig?.version ?? ""} · No guarda ni transfiere dinero.
      </Label>
    </Screen>
  );
}
