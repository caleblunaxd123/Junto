export type DictationState = "idle" | "permission" | "listening" | "finishing";
export type SpeechDriver = {
  available: () => boolean;
  permission: () => Promise<boolean>;
  listen: (events: { start: () => void; result: (text: string) => void; error: (code: string) => void; end: () => void }) => () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export function dictationError(code: string) {
  if (code === "not-allowed") return "No tenemos permiso de micrófono. Puedes habilitarlo en los ajustes o escribir el gasto.";
  if (["no-speech", "speech-timeout"].includes(code)) return "No escuchamos una frase clara. Acércate al micrófono o escribe el gasto.";
  if (["service-not-allowed", "language-not-supported", "unavailable"].includes(code)) return "El dictado no está disponible aquí. Puedes usar el micrófono de tu teclado o escribir.";
  if (code === "network") return "El dictado perdió conexión. Conservamos el texto recibido; puedes corregirlo.";
  return "No pudimos terminar el dictado. Puedes corregir el texto o escribir el gasto.";
}
/** No saving/API calls here. A session owns its listeners; late callbacks cannot edit another form. */
export function createDictation(driver: SpeechDriver, sink: {
  state: (state: DictationState) => void; text: (text: string) => void; error: (message: string) => void;
}, duration = 30_000, finishWait = 3_000) {
  let generation = 0, busy = false, dispose = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timer); timer = undefined; dispose(); dispose = () => {}; };
  const cancel = () => {
    const owned = busy; generation++; busy = false; clear();
    if (owned) { try { driver.abort(); } catch { /* Cancellation is best effort. */ } }
    sink.state("idle");
  };
  const stop = () => {
    if (!busy) return;
    sink.state("finishing"); clearTimeout(timer);
    // Some services never send `end` after `stop`; never leave the screen stuck.
    timer = setTimeout(cancel, finishWait);
    try { driver.stop(); } catch { sink.error(dictationError("unknown")); cancel(); }
  };
  return {
    cancel, stop,
    async start() {
      if (busy) return;
      busy = true; const own = ++generation;
      sink.error(""); sink.state("permission");
      try {
        if (!driver.available()) throw new Error("unavailable");
        if (!await driver.permission()) throw new Error("not-allowed");
        if (own !== generation) return;
        dispose = driver.listen({
          start: () => { if (own === generation) sink.state("listening"); },
          result: text => { if (own === generation) sink.text(Array.from(text).slice(0, 500).join("")); },
          error: code => { if (own === generation) { if (code !== "aborted") sink.error(dictationError(code)); cancel(); } },
          end: () => { if (own === generation) { generation++; busy = false; clear(); sink.state("idle"); } },
        });
        timer = setTimeout(stop, duration);
        driver.start();
      } catch (err) {
        if (own !== generation) return;
        sink.error(dictationError(err instanceof Error ? err.message : "unknown")); cancel();
      }
    },
  };
}
