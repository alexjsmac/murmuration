import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasFirebaseConfig =
  !!firebaseConfig.projectId &&
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.databaseURL;

let app: FirebaseApp | undefined;
let realtimeDb: Database | undefined;

if (hasFirebaseConfig) {
  app =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  realtimeDb = getDatabase(app);
}

export { app, realtimeDb };
