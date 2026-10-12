import type { SpeechDriver } from "./dictation";
import type { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

/** Lazy load: an older installed APK can keep using the manual form without crashing. */
export async function getSpeechDriver(): Promise<SpeechDriver> {
  const module: typeof ExpoSpeechRecognitionModule = (await import("expo-speech-recognition")).ExpoSpeechRecognitionModule;
  return {
    available: () => module.isRecognitionAvailable(),
    permission: async () => (await module.requestPermissionsAsync()).granted,
    listen: events => {
      const listeners = [module.addListener("start", events.start), module.addListener("end", events.end),
        module.addListener("result", event => events.result(event.results[0]?.transcript ?? "")),
        module.addListener("error", event => events.error(event.error))];
      return () => listeners.forEach(listener => listener.remove());
    },
    start: () => module.start({ lang: "es-PE", interimResults: true, continuous: false, maxAlternatives: 1, recordingOptions: { persist: false } }),
    stop: () => module.stop(), abort: () => module.abort(),
  };
}
