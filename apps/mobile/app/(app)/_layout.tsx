import React, { useEffect } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { setSharedVoucher } from "../../src/lib/sharedVoucher";
import { clearPushRegistration, listenForNotificationTaps, registerForPush } from "../../src/lib/push";
import { useAuthStore } from "../../src/store/auth.store";
import { palette } from "../../src/components/ui/Design";

/**
 * Signed-in area. The tabs live in (tabs); every detail screen is pushed on this stack, so it starts
 * fresh each time it opens, goes away when you leave it, and "Volver" returns to where you were.
 */
export default function AppLayout() {
  const { isAuthenticated, usuario } = useAuthStore();
  const userId = usuario?.id;
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && !useAuthStore.getState().signingOut && useAuthStore.getState().isAuthenticated && useAuthStore.getState().usuario?.id === userId;
    void registerForPush(userId, isCurrent, controller.signal);
    const remove = listenForNotificationTaps(router, isCurrent);
    return () => { controller.abort(); remove(); clearPushRegistration(userId); };
  }, [isAuthenticated, userId, router]);
  // "Compartir → JUNTO" from WhatsApp, Yape or the gallery (Android): ask which group it is for.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!isAuthenticated || !hasShareIntent) return;
    const image = shareIntent.files?.find((file) => file.mimeType?.startsWith("image/"));
    resetShareIntent();
    if (!image) return;
    setSharedVoucher({ uri: image.path, mimeType: image.mimeType, size: image.size ?? undefined });
    router.push("/(app)/pagos/compartido");
  }, [isAuthenticated, hasShareIntent, shareIntent, resetShareIntent, router]);
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }} />;
}
