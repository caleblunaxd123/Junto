/**
 * Runs tasks one at a time, in arrival order. Instead of refusing everyone who arrives while a task
 * runs, a few may wait; whoever would wait too long (or finds the line full) gets `busy` and can
 * fall back (type the amount). Used by the single OCR worker.
 */
export function serialQueue(options: { maxWaiting: number; maxWaitMs: number }) {
  let tail: Promise<unknown> = Promise.resolve();
  // Tasks not finished yet: the one running plus those waiting.
  let inLine = 0;
  return function run<T>(task: () => Promise<T>, busy: () => Error): Promise<T> {
    if (inLine > options.maxWaiting) return Promise.reject(busy());
    inLine++;
    const queuedAt = Date.now();
    const turn = tail
      .then(() => {
        if (Date.now() - queuedAt > options.maxWaitMs) throw busy();
        return task();
      })
      .finally(() => { inLine--; });
    tail = turn.catch(() => undefined);
    return turn;
  };
}
