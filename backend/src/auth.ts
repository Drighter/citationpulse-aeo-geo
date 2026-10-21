import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { firestoreRepo, getFirebaseAuth, UserDoc } from './firebase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-aeo-geo-jwt-key-change-in-production-2026';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  scans_used_this_month: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  apiKeyRecord?: {
    id: string;
    name: string;
    scopes: string[];
    rate_limit_per_min: number;
  };
}

// In-memory sliding window rate limiter per API key
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  bucketKey: string,
  limitPerMin: number
): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = rateBuckets.get(bucketKey);

  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limitPerMin - 1), resetInSec: 60 };
  }

  if (entry.count >= limitPerMin) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limitPerMin - entry.count),
    resetInSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verifies either:
 * 1. A Firebase Auth ID Token (`admin.auth().verifyIdToken(token)`) and auto-provisions the user document in Firestore if needed
 * 2. Or a workspace session token when running in local/emulator fallback mode
 */
export async function requireFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing Firebase Bearer token' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const fbAuth = getFirebaseAuth();

  // 1. Try verifying via Firebase Admin Auth first if configured
  if (fbAuth) {
    try {
      const decoded = await fbAuth.verifyIdToken(token);
      let userDoc = await firestoreRepo.getUserById(decoded.uid);
      if (!userDoc) {
        const newUser: UserDoc = {
          id: decoded.uid,
          email: decoded.email || `${decoded.uid}@firebase.user`,
          name: decoded.name || decoded.email?.split('@')[0] || 'Firebase User',
          plan: 'free',
          scans_used_this_month: 0,
          created_at: new Date().toISOString(),
        };
        userDoc = await firestoreRepo.upsertUser(newUser);
      }
      req.user = {
        id: userDoc.id,
        email: userDoc.email,
        name: userDoc.name,
        plan: userDoc.plan,
        scans_used_this_month: userDoc.scans_used_this_month,
      };
      next();
      return;
    } catch {
      // Fall through to session token check if token was issued by local Firebase auth endpoint
    }
  }

  // 2. Verify workspace session token against Firestore user collection
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const userDoc = await firestoreRepo.getUserById(payload.sub);

    if (!userDoc) {
      res.status(401).json({ error: 'Unauthorized: User not found in Firestore' });
      return;
    }

    req.user = {
      id: userDoc.id,
      email: userDoc.email,
      name: userDoc.name,
      plan: userDoc.plan,
      scans_used_this_month: userDoc.scans_used_this_month,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired Firebase token' });
  }
}

export function requireDeveloperApiKey(requiredScope?: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const rawKeyHeader =
      (req.headers['x-api-key'] as string | undefined) ||
      (req.headers.authorization?.startsWith('Bearer ag_') ? req.headers.authorization.slice(7).trim() : undefined);

    if (!rawKeyHeader) {
      res.status(401).json({
        error: 'missing_api_key',
        message: 'Provide a valid developer API key via the X-API-Key header or Authorization: Bearer ag_live_...',
      });
      return;
    }

    const keyHash = crypto.createHash('sha256').update(rawKeyHeader.trim()).digest('hex');
    const keyDoc = await firestoreRepo.getApiKeyByHash(keyHash);

    if (!keyDoc || keyDoc.revoked === 1) {
      res.status(401).json({
        error: 'invalid_api_key',
        message: 'The provided API key is invalid or has been revoked.',
      });
      return;
    }

    const userDoc = await firestoreRepo.getUserById(keyDoc.user_id);
    if (!userDoc) {
      res.status(401).json({
        error: 'invalid_api_key_owner',
        message: 'Workspace owner for this API key no longer exists.',
      });
      return;
    }

    const scopes = keyDoc.scopes.split(',').map((s) => s.trim());
    if (requiredScope && !scopes.includes(requiredScope)) {
      res.status(403).json({
        error: 'insufficient_scope',
        message: `This API key lacks the required scope: ${requiredScope}`,
      });
      return;
    }

    const rate = checkRateLimit(`apikey:${keyDoc.id}`, keyDoc.rate_limit_per_min);
    res.setHeader('X-RateLimit-Limit', String(keyDoc.rate_limit_per_min));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    res.setHeader('X-RateLimit-Reset', String(rate.resetInSec));

    if (!rate.allowed) {
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit of ${keyDoc.rate_limit_per_min} requests/minute exceeded. Try again in ${rate.resetInSec}s.`,
      });
      return;
    }

    await firestoreRepo.recordApiKeyUsage(keyDoc.id);

    req.user = {
      id: userDoc.id,
      email: userDoc.email,
      name: userDoc.name,
      plan: userDoc.plan,
      scans_used_this_month: userDoc.scans_used_this_month,
    };

    req.apiKeyRecord = {
      id: keyDoc.id,
      name: keyDoc.name,
      scopes,
      rate_limit_per_min: keyDoc.rate_limit_per_min,
    };

    next();
  };
}
