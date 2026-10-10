import * as Sentry from '@sentry/node';
import { describeError } from './logSafe';

/** Error monitoring is optional: without SENTRY_DSN nothing is sent anywhere. */
export function initMonitoring() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    // Never send request bodies, cookies or headers: they can contain passwords, codes or tokens.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });
}

export function reportError(error: unknown) {
  // Third-party exceptions can contain request URLs, OTPs or credentials in their message.
  if (process.env.SENTRY_DSN) Sentry.captureException(new Error(describeError(error)));
}
