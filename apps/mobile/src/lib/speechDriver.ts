import type { SpeechDriver } from "./dictation";
import type { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { speechLocale } from "./speechLocale";

/** Lazy load: an older installed APK can keep using the manual form without crashing. */
export async function getSpeechDriver(): Promise<SpeechDriver> {
  const module: typeof ExpoSpeechRecognitionModule = (await import("expo-speech-recognition")).ExpoSpeechRecognitionModule;
  let lang = "es-PE";
  return {
    available: () => module.isRecognitionAvailable(),
    permission: async () => {
      if (!(await module.requestPermissionsAsync()).granted) return false;
      // Enumeration happens before starting: cancellation during this await never opens the mic.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([module.getSupportedLocales({}), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1_500); })]);
        lang = speechLocale(result?.locales ?? []);
      } catch { /* Older services cannot enumerate locales. */ }
      finally { clearTimeout(timer); }
      return true;
    },
    listen: events => {
      const listeners = [module.addListener("start", events.start), module.addListener("end", events.end),
        module.addListener("result", event => events.result(event.results[0]?.transcript ?? "")),
        module.addListener("error", event => events.error(event.error))];
      return () => listeners.forEach(listener => listener.remove());
    },
    start: () => module.start({ lang, interimResults: true, continuous: false, maxAlternatives: 1, recordingOptions: { persist: false } }),
    stop: () => module.stop(), abort: () => module.abort(),
  };
}
