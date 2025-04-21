// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQnoi57s3oL_yHl4yxehHooXafykzT974",
  authDomain: "klycs-58190.firebaseapp.com",
  projectId: "klycs-58190",
  storageBucket: "klycs-58190.firebasestorage.app",
  messagingSenderId: "222603073619",
  appId: "1:222603073619:web:ca9f968c9c7553daddcea6",
  measurementId: "G-JENV802PEF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

export { app, analytics, auth, db, functions, storage }; 