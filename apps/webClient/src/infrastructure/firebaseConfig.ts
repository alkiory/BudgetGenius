// Import the functions you need from the SDKs you need
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeApp, type FirebaseApp } from "firebase/app";

// Your web app's Firebase configuration
// All values are optional strings — missing/empty values are tolerated so the
// app can still load and run (signup/login/etc.) in environments where Firebase
// env vars haven't been provisioned (e.g. CI, preview deploys, local dev
// without a Firebase project). Only services that strictly require configuration
// (Analytics, Auth) will then be skipped — they are not on the critical path
// for email/password signup/login against our NestJS backend.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Wave 1 [T1.4]: the env-var name is `VITE_FIREBASE_MEASUREMENT_ID`
  // (NOT `...MEASURENT_ID`). The historical typo was propagated from
  // the README + 3 GitHub Actions workflows + .env.example templates
  // and silently coerces to `undefined` at runtime because Firebase
  // JS SDK reads `measurementId` as `unknown` if the source string is
  // `undefined`. Renamed across `.env.example`, `README.md`,
  // `knowledge.md`, the controller-side `apps/api/.env.example`, and
  // `firebase-hosting-merge.yml` / `firebase-pull-request.yml` /
  // `build-apk.yml`. GitHub Secrets must be renamed to match (same
  // new name; old name no longer referenced).
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Firebase requires at least apiKey + projectId + appId for any service to
// be usable. If any of these are missing, we skip initialization entirely
// instead of throwing and spamming the console (or breaking the bundle load).
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

// Initialize Analytics asynchronously using Firebase's recommended pattern.
// `isSupported()` checks both browser support (IndexedDB, Cookies) AND config
// validity (projectId present) before we attempt getAnalytics(). This is what
// prevents the noisy "Installations: Missing App configuration value:
// projectId" error in production console.
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
