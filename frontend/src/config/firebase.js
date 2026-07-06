import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyByftYlIvs3LYETYij5VE02jqf-2SgVBIc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "chatapplication-0308.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "chatapplication-0308",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "chatapplication-0308.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "636148871945",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:636148871945:web:3460152127f3d95d7559d8"
};

// Check if a real key has been provided
const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "");

let app = null;
let auth = null;
let storage = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Error initializing Firebase Client SDK:", error);
  }
}

export { app, auth, storage, isConfigured };
export default app;
