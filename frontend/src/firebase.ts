import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;

if (isFirebaseClientConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firestoreDb = getFirestore(firebaseApp);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    connectAuthEmulator(firebaseAuth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestoreDb, 'localhost', 8080);
  }
}

export async function firebaseEmailSignIn(email: string, password: string): Promise<string> {
  if (!firebaseAuth) throw new Error('Firebase client SDK not configured');
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user.getIdToken();
}

export async function firebaseEmailSignUp(name: string, email: string, password: string): Promise<string> {
  if (!firebaseAuth) throw new Error('Firebase client SDK not configured');
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  return cred.user.getIdToken(true);
}

export interface GoogleAuthResult {
  idToken: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

export async function firebaseGoogleSignIn(): Promise<GoogleAuthResult> {
  if (!firebaseAuth) throw new Error('Firebase client SDK not configured');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(firebaseAuth, provider);
  const idToken = await cred.user.getIdToken();
  return {
    idToken,
    uid: cred.user.uid,
    email: cred.user.email || `${cred.user.uid}@google.user`,
    displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Google Workspace User',
    photoURL: cred.user.photoURL,
  };
}

export async function firebaseLogout(): Promise<void> {
  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

export { firebaseApp, firebaseAuth, firestoreDb };
