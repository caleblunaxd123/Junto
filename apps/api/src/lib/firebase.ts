import axios from "axios";
import { describeError } from "./logSafe";
import { initializeApp, cert } from 'firebase-admin';

let firebaseInitialized = false;

export function initFirebase(): void {
  if (
    firebaseInitialized ||
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_PRIVATE_KEY ||
    !process.env.FIREBASE_CLIENT_EMAIL
  ) {
    if (!process.env.FIREBASE_PROJECT_ID) {
      console.warn('[Firebase] Credentials not set — push notifications disabled');
    }
    return;
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });

  firebaseInitialized = true;
  console.info('[Firebase] Initialized successfully');
}

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  // Delivery goes through Expo's push service, which does not need Firebase credentials here
  // (FCM keys are configured in the Expo project). Only real Expo tokens are accepted.
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(expoPushToken)) return;

  try {
    // Expo push token format: ExponentPushToken[...]. A slow push service must never hold a
    // payment or comment request: give up after 5 s.
    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      { to: expoPushToken, title, body, data: data || {}, sound: 'default', priority: 'high' },
      { timeout: 5000, headers: { Accept: 'application/json' }, validateStatus: () => true },
    );
    if (response.status >= 400) {
      console.error('[Firebase] Push notification failed: status', response.status);
    }
  } catch (error) {
    console.error('[Firebase] Error sending push notification:', describeError(error));
  }
}
