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
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import type { ScanReport, ScanSummary } from './types';

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

export async function saveScanToCloudFirestore(userId: string, report: ScanReport, source = 'dashboard'): Promise<void> {
  if (!firestoreDb) return;
  try {
    await setDoc(doc(firestoreDb, 'scans', report.id), {
      id: report.id,
      user_id: userId,
      url: report.url,
      domain: report.domain,
      crawl_depth: report.crawlPagesCount,
      pages_scanned: report.crawlPagesCount,
      overall_score: report.scores.overall,
      seo_score: report.scores.seo,
      aeo_score: report.scores.aeo,
      geo_score: report.scores.geo,
      status: 'completed',
      source,
      result_json: JSON.stringify(report),
      created_at: report.scannedAt,
    });
  } catch {
    // Gracefully ignore if Cloud Firestore API is not yet enabled on the project
  }
}

export async function loadScansFromCloudFirestore(userId: string): Promise<ScanSummary[] | null> {
  if (!firestoreDb) return null;
  try {
    const q = query(collection(firestoreDb, 'scans'), where('user_id', '==', userId));
    const snap = await getDocs(q);
    if (snap.empty) return [];
    const items: ScanSummary[] = [];
    snap.forEach((d) => {
      const data = d.data();
      items.push({
        id: data.id,
        url: data.url,
        domain: data.domain,
        crawl_depth: data.crawl_depth || 1,
        pages_scanned: data.pages_scanned || 1,
        overall_score: data.overall_score,
        seo_score: data.seo_score,
        aeo_score: data.aeo_score,
        geo_score: data.geo_score,
        status: data.status || 'completed',
        source: data.source || 'dashboard',
        created_at: data.created_at,
      });
    });
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return null;
  }
}

export async function loadSingleScanFromCloudFirestore(scanId: string): Promise<ScanReport | null> {
  if (!firestoreDb) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, 'scans', scanId));
    if (snap.exists()) {
      const data = snap.data();
      if (data.result_json) {
        return JSON.parse(data.result_json) as ScanReport;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export { firebaseApp, firebaseAuth, firestoreDb };
