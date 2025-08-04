// src/firebase.ts
import { getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDQs_QLPyB5I5hcV5SUVauc29xViusGHbE',
  authDomain: 'hamcrew-d9378.firebaseapp.com',
  projectId: 'hamcrew-d9378',
  storageBucket: 'hamcrew-d9378.firebasestorage.app',
  messagingSenderId: '1072407823137',
  appId: '1:1072407823137:web:a04b855730dfc350f27460',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
