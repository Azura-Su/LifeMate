import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Run only on a trusted developer machine/server. Never bundle Admin into the app.
// https://firebase.google.com/docs/cloud-messaging/send/admin-sdk
const FCM_DEVICE_TOKEN = process.env.FCM_DEVICE_TOKEN;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const PUSH_TITLE = process.env.PUSH_TITLE;
const PUSH_BODY = process.env.PUSH_BODY;
if (!FCM_DEVICE_TOKEN || !FIREBASE_PROJECT_ID || !PUSH_TITLE || !PUSH_BODY) {
  console.error(
    'Required: FCM_DEVICE_TOKEN, FIREBASE_PROJECT_ID, PUSH_TITLE, PUSH_BODY and Application Default Credentials.',
  );
  process.exitCode = 1;
} else if (PUSH_TITLE.length > 120 || PUSH_BODY.length > 600) {
  console.error(
    'PUSH_TITLE must be at most 120 characters; PUSH_BODY at most 600.',
  );
  process.exitCode = 1;
} else {
  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: FIREBASE_PROJECT_ID,
    });
    await getMessaging().send({
      token: FCM_DEVICE_TOKEN,
      notification: { title: PUSH_TITLE, body: PUSH_BODY },
      android: {
        priority: 'high',
        notification: { channelId: 'lifemate', sound: 'default' },
      },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    console.info('Push sent successfully.');
  } catch (error) {
    console.error(
      'Push failed:',
      typeof error?.code === 'string' ? error.code : 'unknown-error',
    );
    process.exitCode = 1;
  }
}
