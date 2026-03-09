import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─── Firebase Configuration ───────────────────────────────────────
// Replace these values with your Firebase project credentials.
// You can find them in the Firebase Console under:
// Project Settings > General > Your apps > Web app
const firebaseConfig = {
    apiKey: "REMOVED",
    authDomain: "REMOVED",
    projectId: "REMOVED",
    storageBucket: "REMOVED",
    messagingSenderId: "REMOVED",
    appId: "REMOVED",
    measurementId: "REMOVED"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
