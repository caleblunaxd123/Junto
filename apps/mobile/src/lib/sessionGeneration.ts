import { CanceledError } from 'axios';

let generation = 0;
/** Invalidate requests from the prior account before login, logout or session expiry. */
export function beginSession() { return ++generation; }
export function sessionGeneration() { return generation; }
export function requireSession(expected: number) {
  if (expected !== generation) throw new CanceledError('La sesión cambió durante esta solicitud.');
}
