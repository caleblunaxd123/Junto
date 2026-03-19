import admin from 'firebase-admin';

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

  admin.initializeApp({
    credential: admin.credential.cert({
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
  if (!firebaseInitialized) return;

  try {
    // Expo push token format: ExponentPushToken[...]
    // For direct FCM, we'd need native token — using Expo Push API as fallback
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      console.error('[Firebase] Push notification failed:', await response.text());
    }
  } catch (error) {
    console.error('[Firebase] Error sending push notification:', error);
  }
}
