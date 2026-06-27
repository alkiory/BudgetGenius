import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const hasRequiredConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;

if (hasRequiredConfig) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.warn("Firebase app could not be initialized.", e);
  }
} else if (typeof window !== "undefined") {
  console.warn(
    "Firebase configuration is incomplete (missing VITE_FIREBASE_API_KEY, " +
    "VITE_FIREBASE_PROJECT_ID, or VITE_FIREBASE_APP_ID). Skipping Firebase " +
    "initialization — signup/login via email/password will still work.",
  );
}

let analytics: ReturnType<typeof getAnalytics> | null = null;

if (app && typeof window !== "undefined" && typeof document !== "undefined") {
  isSupported()
    .then((supported) => {
      if (!supported) {
        return;
      }
      try {
        analytics = getAnalytics(app as FirebaseApp);
      } catch (e) {
        console.warn("Firebase Analytics could not be initialized.", e);
      }
    })
    .catch((e) => {
      console.warn("Could not check Firebase Analytics support.", e);
    });
}

export { app, analytics };
