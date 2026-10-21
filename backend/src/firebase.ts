import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const PLAN_LIMITS: Record<
  string,
  {
    monthlyScans: number;
    maxCrawlPages: number;
    rateLimitPerMin: number;
    maxApiKeys: number;
    priceMonthly: number;
  }
> = {
  free: {
    monthlyScans: 15,
    maxCrawlPages: 1,
    rateLimitPerMin: 20,
    maxApiKeys: 2,
    priceMonthly: 0,
  },
  pro: {
    monthlyScans: 500,
    maxCrawlPages: 5,
    rateLimitPerMin: 120,
    maxApiKeys: 10,
    priceMonthly: 49,
  },
  enterprise: {
    monthlyScans: 10000,
    maxCrawlPages: 15,
    rateLimitPerMin: 600,
    maxApiKeys: 50,
    priceMonthly: 199,
  },
};

export interface UserDoc {
  id: string;
  email: string;
  name: string;
  password_hash?: string; // Used only when Firebase Auth Emulator / Local fallback is active
  plan: 'free' | 'pro' | 'enterprise';
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  scans_used_this_month: number;
  created_at: string;
}

export interface ApiKeyDoc {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string;
  rate_limit_per_min: number;
  requests_count: number;
  last_used_at: string | null;
  revoked: number;
  created_at: string;
}

export interface ScanDoc {
  id: string;
  user_id: string;
  url: string;
  domain: string;
  crawl_depth: number;
  pages_scanned: number;
  overall_score: number;
  seo_score: number;
  aeo_score: number;
  geo_score: number;
  status: string;
  source: string;
  result_json: string;
  created_at: string;
}

export interface ApiLogDoc {
  id: string;
  api_key_id: string;
  user_id: string;
  endpoint: string;
  method: string;
  target_url: string | null;
  status_code: number;
  latency_ms: number;
  ip_address: string;
  created_at: string;
}

export interface MuseConnectionDoc {
  user_id: string;
  api_url: string;
  api_key_masked: string;
  workspace_id: string;
  business_name: string;
  site_url: string;
  industry: string;
  tagline: string;
  target_audience: string;
  primary_location: string;
  key_services: string[];
  brand_voice: string;
  synced_at: string;
}

export interface LeadOfferDoc {
  id: string;
  user_id: string;
  title: string;
  headline: string;
  description: string;
  offer_type: 'discount' | 'free_trial' | 'consultation' | 'lead_magnet' | 'custom';
  promo_code: string;
  cta_text: string;
  cta_url: string;
  expiration_text: string;
  active: number;
  synced_to_muse: number;
  conversions_count: number;
  created_at: string;
}

// Initialize Firebase Admin if credentials or emulator env vars are present
let firestoreInstance: Firestore | null = null;
let firebaseAuthInstance: Auth | null = null;

export function initFirebaseAdmin() {
  const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  const hasServiceAccount = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_PROJECT_ID
  );

  if (hasEmulator || hasServiceAccount) {
    try {
      if (getApps().length === 0) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          const certObj = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          initializeApp({
            credential: cert(certObj),
            projectId: certObj.project_id || process.env.FIREBASE_PROJECT_ID,
          });
        } else {
          initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'citationpulse-dev',
          });
        }
      }
      firestoreInstance = getFirestore();
      firebaseAuthInstance = getAuth();
      console.log(
        `🔥 Firebase Admin SDK initialized (Project: ${
          process.env.FIREBASE_PROJECT_ID || 'citationpulse-dev'
        }${hasEmulator ? ' [Emulator]' : ''})`
      );
    } catch (err) {
      console.warn('⚠️ Firebase Admin initialization fell back to local Firestore emulator store:', err);
    }
  }
}

initFirebaseAdmin();

export function getFirebaseAuth(): Auth | null {
  return firebaseAuthInstance;
}

export function isCloudFirestoreActive(): boolean {
  return Boolean(firestoreInstance);
}

/**
 * Local JSON-backed Firestore Document Store fallback so the app & tests run out-of-the-box
 * even before the user supplies a live Firebase Service Account JSON or starts `firebase emulators:start`.
 * Uses the exact same collection & document structure (`users`, `scans`, `api_keys`, `api_logs`) as Cloud Firestore.
 */
interface LocalFirestoreDump {
  users: Record<string, UserDoc>;
  api_keys: Record<string, ApiKeyDoc>;
  scans: Record<string, ScanDoc>;
  api_logs: Record<string, ApiLogDoc>;
  muse_connections?: Record<string, MuseConnectionDoc>;
  lead_offers?: Record<string, LeadOfferDoc>;
}

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const localStorePath = path.join(dataDir, 'firestore-local.json');

function loadLocalStore(): LocalFirestoreDump {
  if (fs.existsSync(localStorePath)) {
    try {
      return JSON.parse(fs.readFileSync(localStorePath, 'utf-8')) as LocalFirestoreDump;
    } catch {
      // reset if corrupted
    }
  }
  const now = new Date().toISOString();
  const demoUserId = 'usr_demo_01';
  const demoRawKey = 'ag_live_demo_secret_key_2026';
  const demoKeyHash = crypto.createHash('sha256').update(demoRawKey).digest('hex');

  const initial: LocalFirestoreDump = {
    users: {
      [demoUserId]: {
        id: demoUserId,
        email: 'demo@citationpulse.io',
        name: 'Alex Rivera (Pro Workspace)',
        password_hash: bcrypt.hashSync('demo1234', 10),
        plan: 'pro',
        scans_used_this_month: 2,
        created_at: now,
      },
    },
    api_keys: {
      key_demo_01: {
        id: 'key_demo_01',
        user_id: demoUserId,
        name: 'Production CI/CD Pipeline Key',
        key_prefix: 'ag_live_demo...',
        key_hash: demoKeyHash,
        scopes: 'scan:read,scan:write,fixes:generate',
        rate_limit_per_min: 120,
        requests_count: 14,
        last_used_at: now,
        revoked: 0,
        created_at: now,
      },
    },
    scans: {},
    api_logs: {},
  };
  fs.writeFileSync(localStorePath, JSON.stringify(initial, null, 2));
  return initial;
}

const localData: LocalFirestoreDump = loadLocalStore();

function persistLocalStore() {
  fs.writeFileSync(localStorePath, JSON.stringify(localData, null, 2));
}

// ==================== FIRESTORE REPOSITORY OPERATIONS ====================
export const firestoreRepo = {
  async getUserById(uid: string): Promise<UserDoc | null> {
    if (firestoreInstance) {
      try {
        const snap = await firestoreInstance.collection('users').doc(uid).get();
        if (snap.exists) return snap.data() as UserDoc;
      } catch {
        firestoreInstance = null;
      }
    }
    return localData.users[uid] || null;
  },

  async getUserByEmail(email: string): Promise<UserDoc | null> {
    const normalized = email.toLowerCase().trim();
    if (firestoreInstance) {
      try {
        const q = await firestoreInstance.collection('users').where('email', '==', normalized).limit(1).get();
        if (!q.empty) return q.docs[0].data() as UserDoc;
      } catch {
        firestoreInstance = null;
      }
    }
    return Object.values(localData.users).find((u) => u.email === normalized) || null;
  },

  async upsertUser(user: UserDoc): Promise<UserDoc> {
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('users').doc(user.id).set(user, { merge: true });
      } catch {
        firestoreInstance = null;
      }
    }
    localData.users[user.id] = user;
    persistLocalStore();
    return user;
  },

  async incrementUserScanCount(uid: string): Promise<void> {
    if (firestoreInstance) {
      await firestoreInstance
        .collection('users')
        .doc(uid)
        .update({
          scans_used_this_month: FieldValue.increment(1),
        })
        .catch(() => {});
    }
    if (localData.users[uid]) {
      localData.users[uid].scans_used_this_month += 1;
      persistLocalStore();
    }
  },

  async updateUserPlan(uid: string, plan: 'free' | 'pro' | 'enterprise', subscriptionId: string): Promise<void> {
    const newRateLimit = PLAN_LIMITS[plan].rateLimitPerMin;
    if (firestoreInstance) {
      await firestoreInstance
        .collection('users')
        .doc(uid)
        .set({ plan, stripe_subscription_id: subscriptionId }, { merge: true });

      const keysSnap = await firestoreInstance.collection('api_keys').where('user_id', '==', uid).get();
      const batch = firestoreInstance.batch();
      keysSnap.docs.forEach((d: QueryDocumentSnapshot) => batch.update(d.ref, { rate_limit_per_min: newRateLimit }));
      await batch.commit();
    }

    if (localData.users[uid]) {
      localData.users[uid].plan = plan;
      localData.users[uid].stripe_subscription_id = subscriptionId;
    }
    for (const k of Object.values(localData.api_keys)) {
      if (k.user_id === uid) {
        k.rate_limit_per_min = newRateLimit;
      }
    }
    persistLocalStore();
  },

  async createScan(scan: ScanDoc): Promise<void> {
    if (firestoreInstance) {
      await firestoreInstance.collection('scans').doc(scan.id).set(scan);
    }
    localData.scans[scan.id] = scan;
    persistLocalStore();
  },

  async listScansByUser(uid: string, limit = 50): Promise<Omit<ScanDoc, 'result_json'>[]> {
    if (firestoreInstance) {
      const snap = await firestoreInstance
        .collection('scans')
        .where('user_id', '==', uid)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
      if (!snap.empty) {
        return snap.docs.map((d: QueryDocumentSnapshot) => {
          const { result_json: _, ...rest } = d.data() as ScanDoc;
          return rest;
        });
      }
    }
    return Object.values(localData.scans)
      .filter((s) => s.user_id === uid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(({ result_json: _, ...rest }) => rest);
  },

  async getScanById(id: string, uid: string): Promise<ScanDoc | null> {
    if (firestoreInstance) {
      const doc = await firestoreInstance.collection('scans').doc(id).get();
      if (doc.exists) {
        const data = doc.data() as ScanDoc;
        if (data.user_id === uid) return data;
      }
    }
    const local = localData.scans[id];
    if (local && local.user_id === uid) return local;
    return null;
  },

  async listApiKeysByUser(uid: string): Promise<ApiKeyDoc[]> {
    if (firestoreInstance) {
      const snap = await firestoreInstance
        .collection('api_keys')
        .where('user_id', '==', uid)
        .orderBy('created_at', 'desc')
        .get();
      if (!snap.empty) return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as ApiKeyDoc);
    }
    return Object.values(localData.api_keys)
      .filter((k) => k.user_id === uid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getApiKeyByHash(keyHash: string): Promise<ApiKeyDoc | null> {
    if (firestoreInstance) {
      const snap = await firestoreInstance.collection('api_keys').where('key_hash', '==', keyHash).limit(1).get();
      if (!snap.empty) return snap.docs[0].data() as ApiKeyDoc;
    }
    return Object.values(localData.api_keys).find((k) => k.key_hash === keyHash) || null;
  },

  async createApiKey(keyDoc: ApiKeyDoc): Promise<void> {
    if (firestoreInstance) {
      await firestoreInstance.collection('api_keys').doc(keyDoc.id).set(keyDoc);
    }
    localData.api_keys[keyDoc.id] = keyDoc;
    persistLocalStore();
  },

  async recordApiKeyUsage(keyId: string): Promise<void> {
    const now = new Date().toISOString();
    if (firestoreInstance) {
      await firestoreInstance
        .collection('api_keys')
        .doc(keyId)
        .update({
          requests_count: FieldValue.increment(1),
          last_used_at: now,
        })
        .catch(() => {});
    }
    if (localData.api_keys[keyId]) {
      localData.api_keys[keyId].requests_count += 1;
      localData.api_keys[keyId].last_used_at = now;
      persistLocalStore();
    }
  },

  async revokeApiKey(keyId: string, uid: string): Promise<boolean> {
    if (firestoreInstance) {
      const ref = firestoreInstance.collection('api_keys').doc(keyId);
      const snap = await ref.get();
      if (snap.exists && (snap.data() as ApiKeyDoc).user_id === uid) {
        await ref.update({ revoked: 1 });
        if (localData.api_keys[keyId]) {
          localData.api_keys[keyId].revoked = 1;
          persistLocalStore();
        }
        return true;
      }
    }
    const k = localData.api_keys[keyId];
    if (k && k.user_id === uid) {
      k.revoked = 1;
      persistLocalStore();
      return true;
    }
    return false;
  },

  async createApiLog(logDoc: ApiLogDoc): Promise<void> {
    if (firestoreInstance) {
      await firestoreInstance.collection('api_logs').doc(logDoc.id).set(logDoc);
    }
    localData.api_logs[logDoc.id] = logDoc;
    persistLocalStore();
  },

  async listApiLogsByUser(uid: string, limit = 30): Promise<ApiLogDoc[]> {
    if (firestoreInstance) {
      try {
        const snap = await firestoreInstance
          .collection('api_logs')
          .where('user_id', '==', uid)
          .orderBy('created_at', 'desc')
          .limit(limit)
          .get();
        if (!snap.empty) return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as ApiLogDoc);
      } catch {
        firestoreInstance = null;
      }
    }
    return Object.values(localData.api_logs)
      .filter((l) => l.user_id === uid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  },

  async getMuseConnection(uid: string): Promise<MuseConnectionDoc | null> {
    if (firestoreInstance) {
      try {
        const snap = await firestoreInstance.collection('muse_connections').doc(uid).get();
        if (snap.exists) return snap.data() as MuseConnectionDoc;
      } catch {
        firestoreInstance = null;
      }
    }
    if (!localData.muse_connections) localData.muse_connections = {};
    return localData.muse_connections[uid] || null;
  },

  async saveMuseConnection(conn: MuseConnectionDoc): Promise<MuseConnectionDoc> {
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('muse_connections').doc(conn.user_id).set(conn, { merge: true });
      } catch {
        firestoreInstance = null;
      }
    }
    if (!localData.muse_connections) localData.muse_connections = {};
    localData.muse_connections[conn.user_id] = conn;
    persistLocalStore();
    return conn;
  },

  async listLeadOffers(uid: string): Promise<LeadOfferDoc[]> {
    if (firestoreInstance) {
      try {
        const snap = await firestoreInstance
          .collection('lead_offers')
          .where('user_id', '==', uid)
          .orderBy('created_at', 'desc')
          .get();
        if (!snap.empty) return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as LeadOfferDoc);
      } catch {
        firestoreInstance = null;
      }
    }
    if (!localData.lead_offers) localData.lead_offers = {};
    return Object.values(localData.lead_offers)
      .filter((o) => o.user_id === uid)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async createLeadOffer(offer: LeadOfferDoc): Promise<LeadOfferDoc> {
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('lead_offers').doc(offer.id).set(offer);
      } catch {
        firestoreInstance = null;
      }
    }
    if (!localData.lead_offers) localData.lead_offers = {};
    localData.lead_offers[offer.id] = offer;
    persistLocalStore();
    return offer;
  },

  async toggleLeadOffer(offerId: string, uid: string): Promise<LeadOfferDoc | null> {
    if (!localData.lead_offers) localData.lead_offers = {};
    const existing = localData.lead_offers[offerId];
    if (!existing || existing.user_id !== uid) return null;
    existing.active = existing.active === 1 ? 0 : 1;
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('lead_offers').doc(offerId).update({ active: existing.active });
      } catch {
        firestoreInstance = null;
      }
    }
    persistLocalStore();
    return existing;
  },

  async deleteLeadOffer(offerId: string, uid: string): Promise<boolean> {
    if (!localData.lead_offers) localData.lead_offers = {};
    const existing = localData.lead_offers[offerId];
    if (!existing || existing.user_id !== uid) return false;
    delete localData.lead_offers[offerId];
    if (firestoreInstance) {
      try {
        await firestoreInstance.collection('lead_offers').doc(offerId).delete();
      } catch {
        firestoreInstance = null;
      }
    }
    persistLocalStore();
    return true;
  },
};
