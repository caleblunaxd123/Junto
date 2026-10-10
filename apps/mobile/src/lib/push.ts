import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "./tokenStorage";
import type { Router } from "expo-router";
import { api } from "./api";
import { notificationTarget } from "./notificationTarget";
import { queryClient } from "./queryClient";

type NotificationsModule = typeof import("expo-notifications");

/**
 * Expo Go (Android) cannot receive remote notifications and logs an error when the module loads,
 * so push is only wired in development/standalone builds that have an EAS project.
 */
function pushSupported() {
  if (Platform.OS === "web") return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return !!projectId();
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

let lastRegistration: { userId: string; token: string } | null = null;
const handledResponses = new Set<string>();
const HANDLED_KEY = "junto.notification.handled";
export function clearPushRegistration(userId: string) {
  if (lastRegistration?.userId === userId) lastRegistration = null;
}
export async function registeredPushToken(userId: string) {
  try {
    const saved = JSON.parse(await SecureStore.getItemAsync("pushRegistration") || "null");
    return saved?.userId === userId && typeof saved.token === "string" ? saved.token as string : undefined;
  } catch { return undefined; }
}
export async function forgetPushRegistration(userId: string) {
  clearPushRegistration(userId);
  const token = await registeredPushToken(userId);
  if (token) await SecureStore.deleteItemAsync("pushRegistration");
}

/** Best effort: a denied permission or missing configuration must never block the app. */
export async function registerForPush(userId: string, isCurrent: () => boolean, signal: AbortSignal) {
  try {
    if (!pushSupported() || !isCurrent() || signal.aborted) return;
    const Notifications: NotificationsModule = await import("expo-notifications");
    if (!isCurrent() || signal.aborted) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Avisos de JUNTO",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    if (!isCurrent() || signal.aborted) return;
    let { status } = await Notifications.getPermissionsAsync();
    if (!isCurrent() || signal.aborted) return;
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted" || !isCurrent() || signal.aborted) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    if (!token || !isCurrent() || signal.aborted || (lastRegistration?.userId === userId && lastRegistration.token === token)) return;
    // Remember the exact device before the request; logout can clean up even an in-flight PUT.
    await SecureStore.setItemAsync("pushRegistration", JSON.stringify({ userId, token }));
    if (!isCurrent() || signal.aborted) return;
    await api.put("/auth/push-token", { expoPushToken: token }, { signal });
    if (isCurrent() && !signal.aborted) lastRegistration = { userId, token };
  } catch {
    /* Notifications are an extra channel; payments and balances do not depend on them. */
  }
}

/** Opens what a notification is about (expense, payment or group). Returns a cleanup function. */
export function listenForNotificationTaps(router: Router, isCurrent: () => boolean) {
  let remove: (() => void) | undefined;
  let cancelled = false;
  let liveResponseHandled = false;
  (async () => {
    try {
      if (!pushSupported()) return;
      const Notifications: NotificationsModule = await import("expo-notifications");
      if (cancelled) return;
      const open = async (response: import("expo-notifications").NotificationResponse) => {
        if (cancelled || !isCurrent()) return;
        const identifier = response.notification.request.identifier;
        const target = notificationTarget(response.notification.request.content.data);
        if (!target || handledResponses.has(identifier)) return;
        handledResponses.add(identifier);
        if (handledResponses.size > 50) handledResponses.delete(handledResponses.values().next().value!);
        if ((await SecureStore.getItemAsync(HANDLED_KEY).catch(() => null)) === identifier || cancelled || !isCurrent()) return;
        await SecureStore.setItemAsync(HANDLED_KEY, identifier).catch(() => undefined);
        if (cancelled || !isCurrent()) return;
        router.push(target as Parameters<Router["push"]>[0]);
      };
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        liveResponseHandled = true;
        void open(response);
      });
      const received = Notifications.addNotificationReceivedListener(() => {
        if (cancelled || !isCurrent()) return;
        for (const key of ["pagos", "grupos", "actividad", "comentarios", "invitaciones", "notificaciones"]) void queryClient.invalidateQueries({ queryKey: [key] });
      });
      remove = () => { subscription.remove(); received.remove(); };
      const initial = await Notifications.getLastNotificationResponseAsync();
      if (initial && !liveResponseHandled) await open(initial);
    } catch {
      /* Tapping a notification simply lands on Inicio if this fails. */
    }
  })();
  return () => {
    cancelled = true;
    remove?.();
  };
}
