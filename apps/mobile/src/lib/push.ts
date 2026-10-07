import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { Router } from "expo-router";
import { api } from "./api";

type NotificationsModule = typeof import("expo-notifications");

/**
 * Expo Go (Android) cannot receive remote notifications and logs an error when the module loads,
 * so push is only wired in development/standalone builds that have an EAS project.
 */
function pushSupported() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return !!projectId();
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

let lastRegisteredToken: string | null = null;

/** Best effort: a denied permission or missing configuration must never block the app. */
export async function registerForPush() {
  try {
    if (!pushSupported()) return;
    const Notifications: NotificationsModule = await import("expo-notifications");
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
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    if (!token || token === lastRegisteredToken) return;
    await api.put("/auth/push-token", { expoPushToken: token });
    lastRegisteredToken = token;
  } catch {
    /* Notifications are an extra channel; payments and balances do not depend on them. */
  }
}

/** Opens the group a notification is about. Returns a cleanup function. */
export function listenForNotificationTaps(router: Router) {
  let remove: (() => void) | undefined;
  let cancelled = false;
  (async () => {
    try {
      if (!pushSupported()) return;
      const Notifications: NotificationsModule = await import("expo-notifications");
      if (cancelled) return;
      const open = (data: Record<string, unknown> | undefined) => {
        const grupoId = typeof data?.grupoId === "string" ? data.grupoId : null;
        if (grupoId && /^[0-9a-f-]{36}$/i.test(grupoId)) router.push(`/(app)/grupos/${grupoId}`);
      };
      const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
        open(response.notification.request.content.data),
      );
      remove = () => subscription.remove();
      const initial = await Notifications.getLastNotificationResponseAsync();
      if (initial) open(initial.notification.request.content.data);
    } catch {
      /* Tapping a notification simply lands on Inicio if this fails. */
    }
  })();
  return () => {
    cancelled = true;
    remove?.();
  };
}
