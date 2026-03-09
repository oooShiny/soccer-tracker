import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─── Firebase Configuration ───────────────────────────────────────
// Replace these values with your Firebase project credentials.
// You can find them in the Firebase Console under:
// Project Settings > General > Your apps > Web app
const firebaseConfig = {
    apiKey: "AIzaSyCnwTdGarshLdsntYxlvelQfw5PPljdy1o",
    authDomain: "soccer-tracker-1fbce.firebaseapp.com",
    projectId: "soccer-tracker-1fbce",
    storageBucket: "soccer-tracker-1fbce.firebasestorage.app",
    messagingSenderId: "643942888029",
    appId: "1:643942888029:web:1b784a5f911ca17690d3b4",
    measurementId: "G-26PEM151KH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
