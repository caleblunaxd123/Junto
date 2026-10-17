export type DictationState = "idle" | "permission" | "listening" | "finishing";
export type SpeechDriver = {
  available: () => boolean;
  permission: () => Promise<boolean>;
  listen: (events: { start: () => void; result: (text: string) => void; error: (code: string) => void; end: () => void }) => () => void;
  start: () => void | Promise<void>;
  stop: () => void;
  abort: () => void;
};
export function dictationError(code: string) {
  if (code === "not-allowed") return "No tenemos permiso de micrófono. Puedes habilitarlo en los ajustes o escribir el gasto.";
  if (["no-speech", "speech-timeout"].includes(code)) return "No escuchamos una frase clara. Acércate al micrófono o escribe el gasto.";
  if (["service-not-allowed", "language-not-supported", "unavailable"].includes(code)) return "El dictado no está disponible aquí. Puedes usar el micrófono de tu teclado o escribir.";
  if (code === "network") return "El dictado perdió conexión. Conservamos el texto recibido; puedes corregirlo.";
  if (code === "audio-capture") return "No pudimos acceder al audio. Revisa que el acceso al micrófono del celular esté activado y que otra app no lo esté usando. También puedes dictar desde tu teclado.";
  if (code === "start-timeout") return "El servicio de voz no respondió. Revisa el servicio de reconocimiento de voz en los ajustes del celular o usa el micrófono del teclado.";
  return "No pudimos terminar el dictado. Puedes corregir el texto o escribir el gasto.";
}
/** No saving/API calls here. A session owns its listeners; late callbacks cannot edit another form. */
export function createDictation(driver: SpeechDriver, sink: {
  state: (state: DictationState) => void; text: (text: string) => void; error: (message: string) => void;
}, duration = 30_000, finishWait = 3_000, startWait = 8_000) {
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
        // Some services close the session without a result or an error (nothing heard, mic muted by
        // the system). Say so instead of silently going back to "ready", which looked like a dead mic.
        let heard = false, failed = false;
        dispose = driver.listen({
          start: () => { if (own === generation) { clearTimeout(timer); timer = setTimeout(stop, duration); sink.state("listening"); } },
          result: text => { if (own === generation) { if (text.trim()) heard = true; sink.text(Array.from(text).slice(0, 500).join("")); } },
          error: code => { if (own === generation) { failed = true; if (code !== "aborted") sink.error(dictationError(code)); cancel(); } },
          end: () => { if (own === generation) { generation++; busy = false; clear(); if (!heard && !failed) sink.error(dictationError("no-speech")); sink.state("idle"); } },
        });
        // Start the watchdog after permission: never time out a person reading the permission prompt.
        timer = setTimeout(() => { if (own === generation) { sink.error(dictationError("start-timeout")); cancel(); } }, startWait);
        await driver.start();
      } catch (err) {
        if (own !== generation) return;
        sink.error(dictationError(err instanceof Error ? err.message : "unknown")); cancel();
      }
    },
  };
}
