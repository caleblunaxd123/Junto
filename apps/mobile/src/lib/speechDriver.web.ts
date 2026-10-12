import type { SpeechDriver } from "./dictation";
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export async function getSpeechDriver(): Promise<SpeechDriver> {
  const target = typeof window === "undefined" ? undefined : window as SpeechWindow;
  const Constructor = target?.SpeechRecognition ?? target?.webkitSpeechRecognition;
  let current: Recognition | null = null;
  return {
    available: () => !!Constructor && !!target?.isSecureContext,
    // Browser asks on start; do not fake a permission response or call getUserMedia twice.
    permission: async () => true,
    listen: events => {
      if (!Constructor) throw new Error("unavailable");
      const recognition = new Constructor(); current = recognition;
      recognition.lang = "es-PE"; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1;
      recognition.onstart = events.start; recognition.onend = events.end;
      recognition.onerror = event => events.error(event.error);
      recognition.onresult = event => events.result(Array.from(event.results).map(result => result[0]?.transcript ?? "").join(" "));
      return () => { recognition.onstart = null; recognition.onend = null; recognition.onerror = null; recognition.onresult = null; };
    },
    start: () => current?.start(), stop: () => current?.stop(), abort: () => current?.abort(),
  };
}
