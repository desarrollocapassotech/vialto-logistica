// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAmBcCkWDEGvp1vgFGy5MTSRstrdFgVwcA",
  authDomain: "registro-combustible-logistica.firebaseapp.com",
  projectId: "registro-combustible-logistica",
  storageBucket: "registro-combustible-logistica.firebasestorage.app",
  messagingSenderId: "158028151330",
  appId: "1:158028151330:web:e39f96c0e48c34b37fa87b",
  measurementId: "G-V246WZXNRP"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta los servicios que necesitarás
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);