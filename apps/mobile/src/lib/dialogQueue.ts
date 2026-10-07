export type DialogButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => unknown | Promise<unknown>;
};
export type DialogOptions = {
  tone?: "info" | "success" | "warning" | "danger";
  eyebrow?: string;
  summary?: { label: string; value: string; caption?: string };
  details?: { label: string; value: string }[];
  footnote?: string;
  cancelable?: boolean;
  onDismiss?: () => unknown;
};
export type DialogRequest = DialogOptions & {
  id: number;
  title: string;
  message: string;
  buttons: DialogButton[];
  busy: boolean;
};

// Pure controller: a nested notice never replaces an unanswered confirmation.
export function createDialogQueue() {
  let sequence = 0;
  let queue: DialogRequest[] = [];
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  const alert = (title: string, message = "", buttons?: DialogButton[], options: DialogOptions = {}) => {
    queue = [...queue, { ...options, id: ++sequence, title, message, buttons: buttons?.length ? buttons : [{ text: "Entendido" }], busy: false }];
    publish();
  };
  async function choose(id: number, index?: number) {
    const current = queue[0];
    if (!current || current.id !== id || current.busy) return;
    if (index === undefined && current.cancelable === false) return;
    const button = index === undefined ? current.buttons.find((item) => item.style === "cancel") : current.buttons[index];
    if (index !== undefined && !button) return;
    queue = [{ ...current, busy: true }, ...queue.slice(1)];
    publish();
    try {
      if (button) await button.onPress?.();
      else if (index === undefined) await current.onDismiss?.();
    } catch {
      alert("No pudimos completar la acción", "Revisa tu conexión y el estado de la cuenta antes de reintentar.", undefined, { tone: "danger" });
    } finally {
      queue = queue.filter((item) => item.id !== id);
      publish();
    }
  }
  return {
    alert,
    choose,
    getSnapshot: () => queue[0] || null,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
