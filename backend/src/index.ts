import 'dotenv/config';
import express, { Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { z } from 'zod';
import {
  firestoreRepo,
  getFirebaseAuth,
  isCloudFirestoreActive,
  PLAN_LIMITS,
} from './firebase.js';
import {
  AuthenticatedRequest,
  requireDeveloperApiKey,
  requireFirebaseAuth,
  signSessionToken,
} from './auth.js';
import { runSiteScan } from './scanner.js';

export const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CitationPulse SEO/AEO/GEO Platform & Developer API (Firebase Edition)',
    database: isCloudFirestoreActive() ? 'cloud_firestore' : 'firebase_local_firestore',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ==================== 1. FIREBASE AUTHENTICATION & WORKSPACE ====================
const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(6).max(100),
});

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { email, name, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await firestoreRepo.getUserByEmail(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists in Firebase' });
    return;
  }

  let uid = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const fbAuth = getFirebaseAuth();

  // Also create the user in Firebase Auth if Admin SDK is connected to live/emulator Firebase Auth
  if (fbAuth) {
    try {
      const fbUser = await fbAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: name.trim(),
      });
      uid = fbUser.uid;
    } catch {
      // Fallback to generated uid if Firebase Auth emulator is offline
    }
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  await firestoreRepo.upsertUser({
    id: uid,
    email: normalizedEmail,
    name: name.trim(),
    password_hash: passwordHash,
    plan: 'free',
    scans_used_this_month: 0,
    created_at: now,
  });

  const token = signSessionToken(uid);
  res.status(201).json({
    token,
    user: {
      id: uid,
      email: normalizedEmail,
      name: name.trim(),
      plan: 'free',
      scansUsedThisMonth: 0,
      limits: PLAN_LIMITS.free,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password format' });
    return;
  }

  const { email, password } = parsed.data;
  const user = await firestoreRepo.getUserByEmail(email.toLowerCase().trim());

  if (!user || (user.password_hash && !bcrypt.compareSync(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signSessionToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      scansUsedThisMonth: user.scans_used_this_month,
      limits: PLAN_LIMITS[user.plan] || PLAN_LIMITS.free,
    },
  });
});

// Sync a client-side Firebase Auth ID Token (`firebase/auth` signInWithEmailAndPassword / GooglePopup) with Firestore
app.post('/api/auth/firebase-sync', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  res.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      scansUsedThisMonth: u.scans_used_this_month,
      limits: PLAN_LIMITS[u.plan] || PLAN_LIMITS.free,
    },
  });
});

app.get('/api/auth/me', requireFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  res.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      scansUsedThisMonth: u.scans_used_this_month,
      limits: PLAN_LIMITS[u.plan] || PLAN_LIMITS.free,
    },
  });
});

// ==================== 2. DASHBOARD SCANNER & FIRESTORE HISTORY ====================
const scanRequestSchema = z.object({
  url: z.string().min(3),
  maxPages: z.number().int().min(1).max(15).optional(),
  llmConfig: z
    .object({
      provider: z.enum(['openai', 'gemini']).optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
});

app.post('/api/scans', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = scanRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid scan request parameters', details: parsed.error.flatten() });
    return;
  }

  const user = req.user!;
  const planLimits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  if (user.scans_used_this_month >= planLimits.monthlyScans) {
    res.status(403).json({
      error: 'quota_exceeded',
      message: `You have reached your ${user.plan.toUpperCase()} plan limit of ${planLimits.monthlyScans} scans/month. Upgrade your plan in Billing to continue.`,
    });
    return;
  }

  const requestedMaxPages = parsed.data.maxPages || 1;
  const effectiveMaxPages = Math.min(requestedMaxPages, planLimits.maxCrawlPages);

  try {
    const result = await runSiteScan({
      url: parsed.data.url,
      maxPages: effectiveMaxPages,
      llmConfig: parsed.data.llmConfig,
    });

    const scanId = `scan_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    await firestoreRepo.createScan({
      id: scanId,
      user_id: user.id,
      url: result.url,
      domain: result.domain,
      crawl_depth: effectiveMaxPages,
      pages_scanned: result.crawlPagesCount,
      overall_score: result.scores.overall,
      seo_score: result.scores.seo,
      aeo_score: result.scores.aeo,
      geo_score: result.scores.geo,
      status: 'completed',
      source: 'dashboard',
      result_json: JSON.stringify(result),
      created_at: now,
    });

    await firestoreRepo.incrementUserScanCount(user.id);

    res.status(201).json({
      id: scanId,
      source: 'dashboard',
      createdAt: now,
      ...result,
    });
  } catch (err) {
    res.status(500).json({
      error: 'scan_failed',
      message: err instanceof Error ? err.message : 'Unable to complete site scan',
    });
  }
});

app.get('/api/scans', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const scans = await firestoreRepo.listScansByUser(req.user!.id, 50);
  res.json({ scans });
});

app.get('/api/scans/:id', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const row = await firestoreRepo.getScanById(String(req.params.id), req.user!.id);

  if (!row) {
    res.status(404).json({ error: 'Scan report not found in Firestore' });
    return;
  }

  const parsedResult = JSON.parse(row.result_json);
  res.json({
    id: row.id,
    source: row.source,
    createdAt: row.created_at,
    ...parsedResult,
  });
});

// ==================== 3. DEVELOPER API KEY MANAGEMENT (FIRESTORE) ====================
app.get('/api/keys', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const [keys, logs] = await Promise.all([
    firestoreRepo.listApiKeysByUser(req.user!.id),
    firestoreRepo.listApiLogsByUser(req.user!.id, 30),
  ]);

  res.json({ keys, logs });
});

const createKeySchema = z.object({
  name: z.string().min(2).max(60),
  scopes: z.array(z.enum(['scan:read', 'scan:write', 'fixes:generate'])).min(1).optional(),
});

app.post('/api/keys', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid API key name or scopes' });
    return;
  }

  const user = req.user!;
  const planLimits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  const existingKeys = await firestoreRepo.listApiKeysByUser(user.id);
  const activeCount = existingKeys.filter((k) => k.revoked === 0).length;

  if (activeCount >= planLimits.maxApiKeys) {
    res.status(403).json({
      error: 'key_limit_reached',
      message: `Your ${user.plan.toUpperCase()} tier supports up to ${planLimits.maxApiKeys} active API keys.`,
    });
    return;
  }

  const rawSecret = `ag_live_${crypto.randomBytes(20).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  const keyPrefix = `${rawSecret.slice(0, 14)}...`;
  const id = `key_${crypto.randomBytes(8).toString('hex')}`;
  const scopes = (parsed.data.scopes || ['scan:read', 'scan:write', 'fixes:generate']).join(',');
  const now = new Date().toISOString();

  await firestoreRepo.createApiKey({
    id,
    user_id: user.id,
    name: parsed.data.name.trim(),
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes,
    rate_limit_per_min: planLimits.rateLimitPerMin,
    requests_count: 0,
    last_used_at: null,
    revoked: 0,
    created_at: now,
  });

  res.status(201).json({
    id,
    name: parsed.data.name.trim(),
    rawKey: rawSecret,
    keyPrefix,
    scopes,
    rateLimitPerMin: planLimits.rateLimitPerMin,
    createdAt: now,
  });
});

app.delete('/api/keys/:id', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const revoked = await firestoreRepo.revokeApiKey(String(req.params.id), req.user!.id);

  if (!revoked) {
    res.status(404).json({ error: 'API key not found in Firestore' });
    return;
  }

  res.json({ success: true, id: req.params.id, revoked: true });
});

// ==================== 4. PUBLIC DEVELOPER REST API (/api/v1/*) ====================
async function logDeveloperApiCall(params: {
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  targetUrl?: string;
  statusCode: number;
  latencyMs: number;
  ip?: string;
}) {
  await firestoreRepo.createApiLog({
    id: `log_${crypto.randomBytes(8).toString('hex')}`,
    api_key_id: params.apiKeyId,
    user_id: params.userId,
    endpoint: params.endpoint,
    method: params.method,
    target_url: params.targetUrl || null,
    status_code: params.statusCode,
    latency_ms: params.latencyMs,
    ip_address: params.ip || '127.0.0.1',
    created_at: new Date().toISOString(),
  });
}

app.post('/api/v1/scan', requireDeveloperApiKey('scan:write'), async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const user = req.user!;
  const apiKey = req.apiKeyRecord!;
  const planLimits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  const parsed = scanRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    await logDeveloperApiCall({
      apiKeyId: apiKey.id,
      userId: user.id,
      endpoint: '/api/v1/scan',
      method: 'POST',
      statusCode: 400,
      latencyMs: Date.now() - start,
      ip: req.ip,
    });
    res.status(400).json({
      error: 'invalid_parameters',
      message: 'Body must include a valid "url" string.',
      details: parsed.error.flatten(),
    });
    return;
  }

  if (user.scans_used_this_month >= planLimits.monthlyScans) {
    await logDeveloperApiCall({
      apiKeyId: apiKey.id,
      userId: user.id,
      endpoint: '/api/v1/scan',
      method: 'POST',
      targetUrl: parsed.data.url,
      statusCode: 403,
      latencyMs: Date.now() - start,
      ip: req.ip,
    });
    res.status(403).json({
      error: 'monthly_quota_exceeded',
      message: `Workspace plan (${user.plan}) monthly quota of ${planLimits.monthlyScans} scans reached.`,
    });
    return;
  }

  const effectiveMaxPages = Math.min(parsed.data.maxPages || 1, planLimits.maxCrawlPages);

  try {
    const result = await runSiteScan({
      url: parsed.data.url,
      maxPages: effectiveMaxPages,
      llmConfig: parsed.data.llmConfig,
    });

    const scanId = `scan_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    await firestoreRepo.createScan({
      id: scanId,
      user_id: user.id,
      url: result.url,
      domain: result.domain,
      crawl_depth: effectiveMaxPages,
      pages_scanned: result.crawlPagesCount,
      overall_score: result.scores.overall,
      seo_score: result.scores.seo,
      aeo_score: result.scores.aeo,
      geo_score: result.scores.geo,
      status: 'completed',
      source: 'api',
      result_json: JSON.stringify(result),
      created_at: now,
    });

    await firestoreRepo.incrementUserScanCount(user.id);

    await logDeveloperApiCall({
      apiKeyId: apiKey.id,
      userId: user.id,
      endpoint: '/api/v1/scan',
      method: 'POST',
      targetUrl: result.url,
      statusCode: 200,
      latencyMs: Date.now() - start,
      ip: req.ip,
    });

    res.json({
      id: scanId,
      object: 'scan_report',
      createdAt: now,
      ...result,
    });
  } catch (err) {
    await logDeveloperApiCall({
      apiKeyId: apiKey.id,
      userId: user.id,
      endpoint: '/api/v1/scan',
      method: 'POST',
      targetUrl: parsed.data.url,
      statusCode: 500,
      latencyMs: Date.now() - start,
      ip: req.ip,
    });
    res.status(500).json({
      error: 'scan_execution_error',
      message: err instanceof Error ? err.message : 'Unexpected scanner failure',
    });
  }
});

app.get('/api/v1/scans', requireDeveloperApiKey('scan:read'), async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const user = req.user!;
  const apiKey = req.apiKeyRecord!;

  const rows = await firestoreRepo.listScansByUser(user.id, 25);

  await logDeveloperApiCall({
    apiKeyId: apiKey.id,
    userId: user.id,
    endpoint: '/api/v1/scans',
    method: 'GET',
    statusCode: 200,
    latencyMs: Date.now() - start,
    ip: req.ip,
  });

  res.json({
    object: 'list',
    count: rows.length,
    data: rows,
  });
});

app.get('/api/v1/scans/:id', requireDeveloperApiKey('scan:read'), async (req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const user = req.user!;
  const apiKey = req.apiKeyRecord!;

  const row = await firestoreRepo.getScanById(String(req.params.id), user.id);

  if (!row) {
    await logDeveloperApiCall({
      apiKeyId: apiKey.id,
      userId: user.id,
      endpoint: `/api/v1/scans/${req.params.id}`,
      method: 'GET',
      statusCode: 404,
      latencyMs: Date.now() - start,
      ip: req.ip,
    });
    res.status(404).json({ error: 'not_found', message: 'Scan ID not found in your Firestore workspace' });
    return;
  }

  await logDeveloperApiCall({
    apiKeyId: apiKey.id,
    userId: user.id,
    endpoint: `/api/v1/scans/${req.params.id}`,
    method: 'GET',
    statusCode: 200,
    latencyMs: Date.now() - start,
    ip: req.ip,
  });

  res.json({
    id: row.id,
    object: 'scan_report',
    createdAt: row.created_at,
    ...JSON.parse(row.result_json),
  });
});

// ==================== 5. STRIPE BILLING & SUBSCRIPTION TIER GATING ====================
export const STRIPE_CATALOG = {
  pro: {
    productId: 'prod_VTv58xafGPTXdB',
    monthlyPriceId: 'price_1USxFbJvOop8ROvvmmMgoSk8',
    annualPriceId: 'price_1USxFhJvOop8ROvvsgGoAOct',
    monthlyPaymentLink: 'https://buy.stripe.com/6oUcN65xoeCB7ULdv52cg00',
    annualPaymentLink: 'https://buy.stripe.com/6oU5kE2lc1PP7UL2Qr2cg01',
  },
  enterprise: {
    productId: 'prod_VTv5hM1tC2LmRG',
    monthlyPriceId: 'price_1USxFnJvOop8ROvv4vmLqYWx',
    annualPriceId: 'price_1USxG7JvOop8ROvvgiwe5cxk',
    monthlyPaymentLink: 'https://buy.stripe.com/7sY6oI7Fwaml5MDfDd2cg02',
    annualPaymentLink: 'https://buy.stripe.com/aFacN62lc665fndbmX2cg03',
  },
};

app.get('/api/billing/plans', requireFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  res.json({
    currentPlan: u.plan,
    scansUsedThisMonth: u.scans_used_this_month,
    stripeConfigured: true,
    plans: [
      {
        id: 'free',
        name: 'Starter Free',
        priceMonthly: 0,
        priceAnnualMonthly: 0,
        description: 'Essential SEO, AEO & GEO single-page diagnostics for personal sites.',
        features: [
          '15 full site scans / month',
          'Single-page deep analysis (SEO + AEO + GEO)',
          '2 Developer API keys (20 req/min)',
          'Auto-generated JSON-LD & llms.txt fixes',
        ],
        limits: PLAN_LIMITS.free,
      },
      {
        id: 'pro',
        name: 'Growth Pro',
        priceMonthly: 49,
        priceAnnualMonthly: 39,
        stripe: STRIPE_CATALOG.pro,
        description: 'Multi-page crawling, high-throughput Developer API, and AI citation rewrites.',
        features: [
          '500 scans / month',
          'Multi-page site crawler (up to 5 pages/scan)',
          '10 Developer API keys (120 req/min)',
          'AI-powered Direct Answer & FAQ synthesizer',
          'CI/CD Webhook & REST API integration',
        ],
        limits: PLAN_LIMITS.pro,
      },
      {
        id: 'enterprise',
        name: 'Scale & Agency',
        priceMonthly: 199,
        priceAnnualMonthly: 159,
        stripe: STRIPE_CATALOG.enterprise,
        description: 'Unlimited-scale AEO/GEO monitoring across domains with priority rate limits.',
        features: [
          '10,000 scans / month',
          'Deep multi-page crawler (up to 15 pages/scan)',
          '50 Developer API keys (600 req/min)',
          'Custom OpenAI / Gemini model key pass-through',
          'Dedicated SLA & audit log retention',
        ],
        limits: PLAN_LIMITS.enterprise,
      },
    ],
  });
});

const checkoutSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  mode: z.enum(['stripe', 'instant']).optional(),
});

app.post('/api/billing/checkout', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid target plan' });
    return;
  }

  const targetPlan = parsed.data.plan;
  const cycle = parsed.data.billingCycle || 'monthly';
  const user = req.user!;
  const frontendUrl = process.env.FRONTEND_URL || 'https://citationpulse-aeo-geo.web.app';

  // 1. If Stripe SDK is initialized with secret key and caller requested stripe checkout
  if (stripe && targetPlan !== 'free' && parsed.data.mode === 'stripe') {
    try {
      const catalog = STRIPE_CATALOG[targetPlan];
      const priceId = cycle === 'annual' ? catalog.annualPriceId : catalog.monthlyPriceId;
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          userId: user.id,
          plan: targetPlan,
          billingCycle: cycle,
        },
        success_url: `${frontendUrl}/?upgraded=${targetPlan}&cycle=${cycle}`,
        cancel_url: `${frontendUrl}/?canceled=1`,
      });

      res.json({
        mode: 'stripe_checkout',
        checkoutUrl: session.url,
      });
      return;
    } catch (err) {
      res.status(500).json({
        error: 'stripe_error',
        message: err instanceof Error ? err.message : 'Failed to create Stripe checkout session',
      });
      return;
    }
  }

  // 2. If caller requested hosted Stripe Payment Link redirect
  if (targetPlan !== 'free' && parsed.data.mode === 'stripe') {
    const catalog = STRIPE_CATALOG[targetPlan];
    const baseLink = cycle === 'annual' ? catalog.annualPaymentLink : catalog.monthlyPaymentLink;
    const checkoutUrl = `${baseLink}?prefilled_email=${encodeURIComponent(user.email)}&client_reference_id=${encodeURIComponent(user.id)}`;
    res.json({
      mode: 'stripe_checkout',
      checkoutUrl,
    });
    return;
  }

  // 3. Instant workspace tier update (used after Stripe redirect callback or in test/sandbox mode)
  const simulatedSubId = `sub_stripe_${crypto.randomBytes(6).toString('hex')}`;
  await firestoreRepo.updateUserPlan(user.id, targetPlan, simulatedSubId);

  res.json({
    mode: 'simulated_instant_upgrade',
    plan: targetPlan,
    subscriptionId: simulatedSubId,
    limits: PLAN_LIMITS[targetPlan],
    message: `Workspace updated in Firestore to the ${targetPlan.toUpperCase()} (${cycle}) plan.`,
  });
});

const PORT = Number(process.env.PORT) || 4000;

if (!process.argv.some((arg) => arg.includes('test.ts'))) {
  app.listen(PORT, () => {
    console.log(`CitationPulse SEO/AEO/GEO API Server (Firebase) listening on http://localhost:${PORT}`);
  });
}
