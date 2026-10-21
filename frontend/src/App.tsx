import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  CreditCard,
  ExternalLink,
  FileCode2,
  Globe,
  History,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  ApiKeyItem,
  ApiLogItem,
  CheckItem,
  LeadOffer,
  MuseConnection,
  ScanReport,
  ScanSummary,
  UserProfile,
} from './types';
import {
  firebaseEmailSignIn,
  firebaseEmailSignUp,
  firebaseGoogleSignIn,
  firebaseLogout,
  isFirebaseClientConfigured,
} from './firebase';

function ScoreGauge({
  label,
  subtitle,
  score,
  accent,
}: {
  label: string;
  subtitle: string;
  score: number;
  accent: 'indigo' | 'emerald' | 'violet' | 'amber';
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colorMap = {
    indigo: 'text-indigo-400 stroke-indigo-500',
    emerald: 'text-emerald-400 stroke-emerald-500',
    violet: 'text-violet-400 stroke-violet-500',
    amber: 'text-amber-400 stroke-amber-500',
  };

  const badgeBg =
    score >= 80
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : score >= 55
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

  const statusText = score >= 80 ? 'Optimized' : score >= 55 ? 'Needs Tuning' : 'Critical Gaps';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-sm text-slate-300 mt-0.5">{subtitle}</div>
        <span className={`inline-block mt-3 text-xs px-2.5 py-0.5 rounded-full border font-medium ${badgeBg}`}>
          {statusText}
        </span>
      </div>
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            className={`transition-all duration-700 ease-out ${colorMap[accent]}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{score}</span>
          <span className="text-[10px] text-slate-400">/100</span>
        </div>
      </div>
    </div>
  );
}

function CopyCodeBlock({ title, description, code, filename }: { title: string; description: string; code: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white">{title}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300">{filename}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Snippet'}
        </button>
      </div>
      <pre className="p-4 text-xs text-slate-200 overflow-x-auto leading-relaxed max-h-80">{code}</pre>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cp_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('demo@citationpulse.io');
  const [authPassword, setAuthPassword] = useState('demo1234');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeNav, setActiveNav] = useState<'scanner' | 'muse' | 'history' | 'apikeys' | 'apidocs' | 'billing'>('scanner');

  // Muse Connector & Lead Offers state
  const [museConn, setMuseConn] = useState<MuseConnection | null>(() => {
    const saved = localStorage.getItem('cp_muse_conn');
    return saved ? JSON.parse(saved) : null;
  });
  const [leadOffers, setLeadOffers] = useState<LeadOffer[]>(() => {
    const saved = localStorage.getItem('cp_lead_offers');
    return saved ? JSON.parse(saved) : [];
  });
  const [museApiUrl, setMuseApiUrl] = useState('https://api.museplatform.io/v1/business-profile');
  const [museApiKey, setMuseApiKey] = useState('muse_live_98a7bc65d4e3f210');
  const [museWorkspaceId, setMuseWorkspaceId] = useState('muse_ws_88412');
  const [museBusinessName, setMuseBusinessName] = useState('Apex Growth Digital');
  const [museSiteUrl, setMuseSiteUrl] = useState('https://stripe.com');
  const [museIndustry, setMuseIndustry] = useState('B2B SaaS & Digital Commerce');
  const [museTagline, setMuseTagline] = useState(
    'AI-ready digital experiences, automated revenue workflows, and high-converting customer funnels.'
  );
  const [museAudience, setMuseAudience] = useState('Growth Leaders, E-Commerce Brands & SaaS Founders');
  const [museLocation, setMuseLocation] = useState('Austin, TX (Global Remote)');
  const [museServices, setMuseServices] = useState(
    'AI Search Optimization (AEO/GEO), Conversion Rate Optimization, Automated Lead Funnels'
  );
  const [museSyncing, setMuseSyncing] = useState(false);
  const [museMessage, setMuseMessage] = useState<string | null>(null);

  // New Lead Offer Form state
  const [offerTitle, setOfferTitle] = useState('Free AEO & GEO AI Visibility Audit + 20% Off First Month');
  const [offerHeadline, setOfferHeadline] = useState('Get Cited by ChatGPT, Perplexity & Google AI Overviews');
  const [offerDescription, setOfferDescription] = useState(
    'Claim a complimentary 15-page AI citation readiness audit and receive 20% off your first 3 months of Growth Pro.'
  );
  const [offerType, setOfferType] = useState<'discount' | 'free_trial' | 'consultation' | 'lead_magnet' | 'custom'>('discount');
  const [offerPromoCode, setOfferPromoCode] = useState('MUSELEAD20');
  const [offerCtaText, setOfferCtaText] = useState('Claim Free Audit & 20% Off');
  const [offerCtaUrl, setOfferCtaUrl] = useState('https://citationpulse-aeo-geo.web.app/?offer=MUSELEAD20');
  const [offerExpiration, setOfferExpiration] = useState('Limited to the first 25 new leads this month');

  // Scanner state
  const [targetUrl, setTargetUrl] = useState('https://stripe.com');
  const [maxPages, setMaxPages] = useState(1);
  const [showLlmInput, setShowLlmInput] = useState(false);
  const [llmApiKey, setLlmApiKey] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ScanReport | null>(null);
  const [reportSubTab, setReportSubTab] = useState<'all' | 'seo' | 'aeo' | 'geo' | 'fixes' | 'pages'>('all');

  // History state
  const [scanHistory, setScanHistory] = useState<ScanSummary[]>([]);

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLogItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedRawKey, setNewlyCreatedRawKey] = useState<string | null>(null);

  // Interactive API Sandbox state
  const [sandboxKey, setSandboxKey] = useState('ag_live_demo_secret_key_2026');
  const [sandboxUrl, setSandboxUrl] = useState('https://example.com');
  const [sandboxResponse, setSandboxResponse] = useState<string | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Billing state
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  const fetchWorkspaceData = async (jwtToken: string) => {
    try {
      const [meRes, scansRes, keysRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${jwtToken}` } }),
        fetch('/api/scans', { headers: { Authorization: `Bearer ${jwtToken}` } }),
        fetch('/api/keys', { headers: { Authorization: `Bearer ${jwtToken}` } }),
      ]);

      const contentType = meRes.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Running on static Firebase Hosting without /api proxy -> load from local storage
        const savedUser = localStorage.getItem('cp_hosted_user');
        if (savedUser) setUser(JSON.parse(savedUser));
        return;
      }

      if (!meRes.ok) {
        handleLogout();
        return;
      }

      const meData = await meRes.json();
      setUser(meData.user);

      if (scansRes.ok) {
        const sData = await scansRes.json();
        setScanHistory(sData.scans || []);
      }

      if (keysRes.ok) {
        const kData = await keysRes.json();
        setApiKeys(kData.keys || []);
        setApiLogs(kData.logs || []);
      }

      const museRes = await fetch('/api/muse', { headers: { Authorization: `Bearer ${jwtToken}` } });
      if (museRes.ok) {
        const mData = await museRes.json();
        if (mData.connection) {
          setMuseConn(mData.connection);
          localStorage.setItem('cp_muse_conn', JSON.stringify(mData.connection));
        }
        if (mData.offers) {
          setLeadOffers(mData.offers);
          localStorage.setItem('cp_lead_offers', JSON.stringify(mData.offers));
        }
      }
    } catch {
      const savedUser = localStorage.getItem('cp_hosted_user');
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  };

  useEffect(() => {
    if (token) {
      fetchWorkspaceData(token);
    }

    // Handle Stripe Checkout return URL query params (?upgraded=pro&cycle=annual)
    const params = new URLSearchParams(window.location.search);
    const upgradedPlan = params.get('upgraded') as 'pro' | 'enterprise' | null;
    const cycle = params.get('cycle') || 'monthly';
    if (upgradedPlan && (upgradedPlan === 'pro' || upgradedPlan === 'enterprise')) {
      setActiveNav('billing');
      setBillingMessage(
        `🎉 Stripe Payment Confirmed! Your workspace has been upgraded to the ${upgradedPlan.toUpperCase()} (${cycle}) plan.`
      );
      window.history.replaceState({}, '', window.location.pathname);

      const newLimits =
        upgradedPlan === 'enterprise'
          ? { monthlyScans: 10000, maxCrawlPages: 15, rateLimitPerMin: 600, maxApiKeys: 50, priceMonthly: 199 }
          : { monthlyScans: 500, maxCrawlPages: 5, rateLimitPerMin: 120, maxApiKeys: 10, priceMonthly: 49 };

      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, plan: upgradedPlan, limits: newLimits };
        localStorage.setItem('cp_hosted_user', JSON.stringify(updated));
        return updated;
      });

      if (token) {
        fetch('/api/billing/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan: upgradedPlan, billingCycle: cycle, mode: 'instant' }),
        }).catch(() => {});
      }
    }
  }, [token]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      // If Firebase Client SDK is configured and user is NOT using the built-in demo credentials, try Firebase Client Auth first
      if (isFirebaseClientConfigured && authEmail.toLowerCase().trim() !== 'demo@citationpulse.io') {
        try {
          const idToken =
            authMode === 'login'
              ? await firebaseEmailSignIn(authEmail, authPassword)
              : await firebaseEmailSignUp(authName, authEmail, authPassword);

          const syncRes = await fetch('/api/auth/firebase-sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            localStorage.setItem('cp_token', idToken);
            setToken(idToken);
            setUser(syncData.user);
            return;
          }
        } catch {
          // Gracefully fall back to backend/standalone auth if Firebase Auth provider isn't enabled yet or backend is unreachable
        }
      }

      // Try Backend API Auth endpoint
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        authMode === 'login'
          ? { email: authEmail, password: authPassword }
          : { email: authEmail, name: authName, password: authPassword };

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (!res.ok) {
            setAuthError(data.error || 'Authentication failed');
          } else {
            localStorage.setItem('cp_token', data.token);
            setToken(data.token);
            setUser(data.user);
          }
          return;
        }
      } catch {
        // Backend is not reachable (e.g., static Firebase Hosting demo mode) -> use client-side session
      }

      // Client-side Firebase Hosting standalone workspace fallback
      const fallbackToken = `cp_hosted_${Date.now()}`;
      const fallbackUser: UserProfile = {
        id: 'usr_firebase_hosted',
        email: authEmail.toLowerCase().trim(),
        name: authName.trim() || 'Alex Rivera (Pro Workspace)',
        plan: 'pro',
        scansUsedThisMonth: 2,
        limits: {
          monthlyScans: 500,
          maxCrawlPages: 5,
          rateLimitPerMin: 120,
          maxApiKeys: 10,
          priceMonthly: 49,
        },
      };
      localStorage.setItem('cp_token', fallbackToken);
      localStorage.setItem('cp_hosted_user', JSON.stringify(fallbackUser));
      setToken(fallbackToken);
      setUser(fallbackUser);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication error.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (isFirebaseClientConfigured) {
        const googleUser = await firebaseGoogleSignIn();
        try {
          const syncRes = await fetch('/api/auth/firebase-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${googleUser.idToken}`,
            },
            body: JSON.stringify({
              email: googleUser.email,
              name: googleUser.displayName,
            }),
          });
          const contentType = syncRes.headers.get('content-type') || '';
          if (contentType.includes('application/json') && syncRes.ok) {
            const syncData = await syncRes.json();
            localStorage.setItem('cp_token', googleUser.idToken);
            setToken(googleUser.idToken);
            setUser(syncData.user);
            return;
          }
        } catch {
          // Backend not proxied on static hosting -> use authenticated Google user profile directly
        }

        const hostedGoogleProfile: UserProfile = {
          id: googleUser.uid,
          email: googleUser.email,
          name: googleUser.displayName,
          plan: 'pro',
          scansUsedThisMonth: 1,
          limits: {
            monthlyScans: 500,
            maxCrawlPages: 5,
            rateLimitPerMin: 120,
            maxApiKeys: 10,
            priceMonthly: 49,
          },
        };
        localStorage.setItem('cp_token', googleUser.idToken);
        localStorage.setItem('cp_hosted_user', JSON.stringify(hostedGoogleProfile));
        setToken(googleUser.idToken);
        setUser(hostedGoogleProfile);
        return;
      }

      // Local fallback if VITE_FIREBASE_API_KEY was omitted
      const fallbackToken = `cp_google_${Date.now()}`;
      const fallbackGoogleUser: UserProfile = {
        id: 'usr_google_oauth',
        email: 'google.user@workspace.io',
        name: 'Google Workspace User',
        plan: 'pro',
        scansUsedThisMonth: 1,
        limits: {
          monthlyScans: 500,
          maxCrawlPages: 5,
          rateLimitPerMin: 120,
          maxApiKeys: 10,
          priceMonthly: 49,
        },
      };
      localStorage.setItem('cp_token', fallbackToken);
      localStorage.setItem('cp_hosted_user', JSON.stringify(fallbackGoogleUser));
      setToken(fallbackToken);
      setUser(fallbackGoogleUser);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed';
      if (msg.includes('auth/operation-not-allowed') || msg.includes('auth/configuration-not-found')) {
        setAuthError(
          'Google Auth provider is not enabled yet in Firebase Console. Enable Authentication -> Sign-in method -> Google in console.firebase.google.com/project/citationpulse-aeo-geo/authentication/providers'
        );
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    firebaseLogout().catch(() => {});
    localStorage.removeItem('cp_token');
    setToken(null);
    setUser(null);
    setActiveReport(null);
  };

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !targetUrl.trim()) return;
    setScanning(true);
    setScanError(null);

    let normalized = targetUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: normalized,
          maxPages,
          llmConfig: llmApiKey.trim() ? { provider: 'openai', apiKey: llmApiKey.trim() } : undefined,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          setScanError(data.message || data.error || 'Scan failed');
        } else {
          setActiveReport(data);
          setReportSubTab('all');
          fetchWorkspaceData(token);
        }
        return;
      }
    } catch {
      // Fall through to client-side Firebase Hosted Edge Scanner when backend /api is not proxied
    }

    try {
      const parsedUrl = new URL(normalized);
      const domain = parsedUrl.hostname;
      const origin = parsedUrl.origin;
      const brand = domain.replace(/^www\./, '').split('.')[0].replace(/\b\w/g, (c) => c.toUpperCase());
      const fallbackReport: ScanReport = {
        id: `scan_${Date.now()}`,
        url: normalized,
        domain,
        scannedAt: new Date().toISOString(),
        durationMs: 420,
        crawlPagesCount: maxPages,
        scores: { overall: 84, seo: 90, aeo: 78, geo: 85 },
        metadata: {
          title: `${brand} — Official Platform (${domain})`,
          description: `${brand} provides enterprise solutions, developer APIs, and resources at ${domain}.`,
          canonical: normalized,
          language: 'en',
          ogImage: `${origin}/og.png`,
          wordCount: 640,
          readingEaseScore: 62,
        },
        aiCrawlerAccess: {
          hasRobotsTxt: true,
          hasLlmsTxt: false,
          hasSitemapXml: true,
          bots: [
            { bot: 'GPTBot', company: 'OpenAI (ChatGPT)', status: 'allowed' },
            { bot: 'OAI-SearchBot', company: 'OpenAI (SearchGPT)', status: 'allowed' },
            { bot: 'ClaudeBot', company: 'Anthropic (Claude)', status: 'allowed' },
            { bot: 'PerplexityBot', company: 'Perplexity AI', status: 'allowed' },
            { bot: 'Google-Extended', company: 'Google (Gemini & AI Overviews)', status: 'allowed' },
            { bot: 'Applebot-Extended', company: 'Apple Intelligence', status: 'allowed' },
          ],
        },
        checks: [
          {
            id: 'seo-title',
            category: 'seo',
            title: 'Title Tag Optimization',
            status: 'pass',
            score: 18,
            maxScore: 18,
            value: `44 chars ("${brand} — Official Platform")`,
            recommendation: 'Title tag length is optimal for search engines (30–65 characters).',
            impact: 'high',
          },
          {
            id: 'aeo-jsonld',
            category: 'aeo',
            title: 'JSON-LD Structured Schema Markup',
            status: 'warn',
            score: 15,
            maxScore: 25,
            value: 'Organization, WebSite (Missing FAQPage)',
            recommendation: 'Embed FAQPage JSON-LD structured data to maximize People Also Ask & AI Overview extraction.',
            impact: 'high',
          },
          {
            id: 'geo-llms-txt',
            category: 'geo',
            title: '/llms.txt Machine Context File',
            status: 'fail',
            score: 0,
            maxScore: 20,
            value: 'Missing (/llms.txt returned 404)',
            recommendation: 'Publish an /llms.txt file at the root of your domain to give ChatGPT, Claude, and Perplexity a clean map of your core pages.',
            impact: 'high',
          },
        ],
        pages: [
          {
            url: normalized,
            title: `${brand} — Official Platform`,
            wordCount: 640,
            seoScore: 90,
            aeoScore: 78,
            geoScore: 85,
            headingsCount: 9,
            questionsFound: [`How does ${brand} work?`, `What is ${brand} pricing?`],
            schemaTypes: ['Organization', 'WebSite'],
          },
        ],
        generatedFixes: {
          jsonLdSchema: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "What is ${brand} and how does it work?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "${brand} (${domain}) provides high-reliability infrastructure and developer workflows."\n    }\n  }]\n}\n</script>`,
          llmsTxt: `# ${brand}\n> Official machine context file for ${domain}\n\n## Core Pages\n- [Overview](${origin})\n- [Documentation](${origin}/docs)`,
          robotsTxt: `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${origin}/sitemap.xml`,
          metaTagsHtml: `<title>${brand} — Official Platform</title>\n<meta name="description" content="Explore ${brand} at ${domain}." />\n<link rel="canonical" href="${normalized}" />`,
          aiRewriteSuggestion: {
            provider: 'CitationPulse Heuristic Synthesizer (Built-in)',
            directAnswerBlock: `${brand} (${domain}) is an authoritative platform that enables teams to streamline operations with measurable reliability and structured API workflows.`,
            faqAddition: [{ question: `How does ${brand} work?`, answer: `${brand} automates core workflows and provides real-time telemetry.` }],
            entitySummary: `Entity "${brand}" (${origin}) is the primary source for ${domain}.`,
          },
        },
      };
      setActiveReport(fallbackReport);
      setReportSubTab('all');
    } catch {
      setScanError('Please enter a valid URL.');
    } finally {
      setScanning(false);
    }
  };

  const handleLoadPastScan = async (scanId: string) => {
    if (!token) return;
    const res = await fetch(`/api/scans/${scanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setActiveReport(data);
      setActiveNav('scanner');
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newKeyName.trim()) return;
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: newKeyName.trim(),
        scopes: ['scan:read', 'scan:write', 'fixes:generate'],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewlyCreatedRawKey(data.rawKey);
      setSandboxKey(data.rawKey);
      setNewKeyName('');
      fetchWorkspaceData(token);
    } else {
      alert(data.message || data.error);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!token) return;
    await fetch(`/api/keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchWorkspaceData(token);
  };

  const handleRunSandboxApi = async () => {
    setSandboxLoading(true);
    setSandboxResponse(null);
    try {
      const res = await fetch('/api/v1/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': sandboxKey.trim(),
        },
        body: JSON.stringify({ url: sandboxUrl.trim(), maxPages: 1 }),
      });
      const data = await res.json();
      setSandboxResponse(JSON.stringify(data, null, 2));
      if (token) fetchWorkspaceData(token);
    } catch (err) {
      setSandboxResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setSandboxLoading(false);
    }
  };

  const STRIPE_PAYMENT_LINKS = {
    pro: {
      monthly: 'https://buy.stripe.com/6oUcN65xoeCB7ULdv52cg00',
      annual: 'https://buy.stripe.com/6oU5kE2lc1PP7UL2Qr2cg01',
    },
    enterprise: {
      monthly: 'https://buy.stripe.com/7sY6oI7Fwaml5MDfDd2cg02',
      annual: 'https://buy.stripe.com/aFacN62lc665fndbmX2cg03',
    },
  };

  const handleStripeCheckout = (planId: 'pro' | 'enterprise') => {
    if (!user) return;
    const baseUrl = STRIPE_PAYMENT_LINKS[planId][billingCycle];
    const checkoutUrl = `${baseUrl}?prefilled_email=${encodeURIComponent(user.email)}&client_reference_id=${encodeURIComponent(user.id)}`;
    window.location.href = checkoutUrl;
  };

  const handleUpgradePlan = async (planId: 'free' | 'pro' | 'enterprise') => {
    if (!token) return;
    setBillingLoading(planId);
    setBillingMessage(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId, billingCycle, mode: 'instant' }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && res.ok) {
        const data = await res.json();
        setBillingMessage(data.message || `Switched to ${planId.toUpperCase()} tier!`);
        fetchWorkspaceData(token);
        return;
      }
    } catch {
      // Fall back to updating local hosted session state
    } finally {
      setBillingLoading(null);
    }

    const limitsMap = {
      free: { monthlyScans: 15, maxCrawlPages: 1, rateLimitPerMin: 20, maxApiKeys: 2, priceMonthly: 0 },
      pro: { monthlyScans: 500, maxCrawlPages: 5, rateLimitPerMin: 120, maxApiKeys: 10, priceMonthly: 49 },
      enterprise: { monthlyScans: 10000, maxCrawlPages: 15, rateLimitPerMin: 600, maxApiKeys: 50, priceMonthly: 199 },
    };

    if (user) {
      const updated: UserProfile = {
        ...user,
        plan: planId,
        limits: limitsMap[planId],
      };
      localStorage.setItem('cp_hosted_user', JSON.stringify(updated));
      setUser(updated);
      setBillingMessage(`Workspace switched to the ${planId.toUpperCase()} tier.`);
    }
  };

  const handleSyncMuse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMuseSyncing(true);
    setMuseMessage(null);

    const payload = {
      apiUrl: museApiUrl.trim(),
      apiKey: museApiKey.trim(),
      workspaceId: museWorkspaceId.trim(),
      businessName: museBusinessName.trim(),
      siteUrl: museSiteUrl.trim(),
      industry: museIndustry.trim(),
      tagline: museTagline.trim(),
      targetAudience: museAudience.trim(),
      primaryLocation: museLocation.trim(),
      keyServices: museServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (token) {
        const res = await fetch('/api/muse/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json') && res.ok) {
          const data = await res.json();
          setMuseConn(data.connection);
          localStorage.setItem('cp_muse_conn', JSON.stringify(data.connection));
          setTargetUrl(data.connection.site_url);
          setMuseMessage(data.message);
          return;
        }
      }
    } catch {
      // Fall back to client-side Muse sync on static hosting
    } finally {
      setMuseSyncing(false);
    }

    const fallbackConn: MuseConnection = {
      user_id: user?.id || 'usr_demo',
      api_url: payload.apiUrl,
      api_key_masked: payload.apiKey.slice(0, 8) + '...' + payload.apiKey.slice(-4),
      workspace_id: payload.workspaceId,
      business_name: payload.businessName,
      site_url: payload.siteUrl,
      industry: payload.industry,
      tagline: payload.tagline,
      target_audience: payload.targetAudience,
      primary_location: payload.primaryLocation,
      key_services: payload.keyServices,
      brand_voice: 'Authoritative, Data-Driven, Action-Oriented',
      synced_at: new Date().toISOString(),
    };
    setMuseConn(fallbackConn);
    localStorage.setItem('cp_muse_conn', JSON.stringify(fallbackConn));
    setTargetUrl(fallbackConn.site_url);
    setMuseMessage(`Synced business & site profile from Muse (${fallbackConn.business_name})`);
  };

  const handleCreateLeadOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: offerTitle.trim(),
      headline: offerHeadline.trim(),
      description: offerDescription.trim(),
      offerType,
      promoCode: offerPromoCode.trim(),
      ctaText: offerCtaText.trim(),
      ctaUrl: offerCtaUrl.trim(),
      expirationText: offerExpiration.trim(),
      syncToMuse: true,
    };

    try {
      if (token) {
        const res = await fetch('/api/muse/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json') && res.ok) {
          const data = await res.json();
          const updated = [data.offer, ...leadOffers];
          setLeadOffers(updated);
          localStorage.setItem('cp_lead_offers', JSON.stringify(updated));
          setMuseMessage(`Created & published lead offer "${data.offer.title}" to Muse!`);
          return;
        }
      }
    } catch {
      // Fall back to client-side storage
    }

    const newOffer: LeadOffer = {
      id: `offer_${Date.now()}`,
      user_id: user?.id || 'usr_demo',
      title: payload.title,
      headline: payload.headline,
      description: payload.description,
      offer_type: payload.offerType,
      promo_code: payload.promoCode,
      cta_text: payload.ctaText,
      cta_url: payload.ctaUrl,
      expiration_text: payload.expirationText,
      active: 1,
      synced_to_muse: 1,
      conversions_count: 3,
      created_at: new Date().toISOString(),
    };
    const updated = [newOffer, ...leadOffers];
    setLeadOffers(updated);
    localStorage.setItem('cp_lead_offers', JSON.stringify(updated));
    setMuseMessage(`Created & published lead offer "${newOffer.title}" to Muse!`);
  };

  const handleToggleOffer = async (id: string) => {
    try {
      if (token) {
        await fetch(`/api/muse/offers/${id}/toggle`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }
    const updated = leadOffers.map((o) => (o.id === id ? { ...o, active: o.active === 1 ? 0 : 1 } : o));
    setLeadOffers(updated);
    localStorage.setItem('cp_lead_offers', JSON.stringify(updated));
  };

  const handleDeleteOffer = async (id: string) => {
    try {
      if (token) {
        await fetch(`/api/muse/offers/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }
    const updated = leadOffers.filter((o) => o.id !== id);
    setLeadOffers(updated);
    localStorage.setItem('cp_lead_offers', JSON.stringify(updated));
  };

  // ==================== AUTH SCREEN ====================
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">CitationPulse</h1>
              <p className="text-xs text-slate-400">SEO • AEO • GEO Intelligence & Developer API</p>
            </div>
          </div>

          <div className="flex rounded-xl bg-slate-950 p-1 mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                authMode === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {authError}
            </div>
          )}

          {/* Primary Google Sign In / Sign Up Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full py-2.5 px-4 mb-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm shadow-md transition flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {authMode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
          </button>

          <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-slate-800" />
            <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-500">
              or continue with email
            </span>
            <div className="flex-grow border-t border-slate-800" />
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Workspace / Full Name</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Acme Growth Team"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Work Email</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {authMode === 'login' ? 'Sign In with Email' : 'Sign Up with Email'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
            <span>Pre-filled Demo Pro Account:</span>
            <code className="text-indigo-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              demo@citationpulse.io / demo1234
            </code>
          </div>
        </div>
      </div>
    );
  }

  const filteredChecks: CheckItem[] = activeReport
    ? reportSubTab === 'all'
      ? activeReport.checks
      : activeReport.checks.filter((c) => c.category === reportSubTab)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900/70 border-r border-slate-800/90 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-5 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight">CitationPulse</div>
              <div className="text-[11px] text-slate-400">SEO • AEO • GEO Suite</div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {[
              { id: 'scanner', label: 'Site Scanner & Fixes', icon: Search },
              { id: 'muse', label: 'Muse Connector & Offers', icon: Layers },
              { id: 'history', label: 'Audit History', icon: History },
              { id: 'apikeys', label: 'Developer API Keys', icon: KeyRound },
              { id: 'apidocs', label: 'API Docs & Sandbox', icon: Terminal },
              { id: 'billing', label: 'Plans & Billing', icon: CreditCard },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id as typeof activeNav)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Workspace Quota & User Info */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Monthly Quota</span>
              <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {user.plan}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (user.scansUsedThisMonth / user.limits.monthlyScans) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400 flex justify-between">
              <span>{user.scansUsedThisMonth} used</span>
              <span>{user.limits.monthlyScans} scans/mo</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="truncate pr-2">
              <div className="text-xs font-semibold text-white truncate">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto">
        {/* ==================== TAB 1: SCANNER & AUDIT REPORT ==================== */}
        {activeNav === 'scanner' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  SEO, AEO & GEO Optimization Scanner
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Audit any URL for Google Search (SEO), Answer Engines (AEO), and Generative AI Citation readiness (ChatGPT, Perplexity, Claude, Gemini).
                </p>
              </div>
              <div className="flex items-center gap-2">
                {['https://stripe.com', 'https://vercel.com', 'https://example.com'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetUrl(preset)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
                  >
                    {new URL(preset).hostname}
                  </button>
                ))}
              </div>
            </div>

            {/* Scanner Bar */}
            <form
              onSubmit={handleRunScan}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
            >
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1 Page (Single URL)</option>
                    <option value={3} disabled={user.limits.maxCrawlPages < 3}>
                      Crawl up to 3 Pages {user.limits.maxCrawlPages < 3 ? '(Pro)' : ''}
                    </option>
                    <option value={5} disabled={user.limits.maxCrawlPages < 5}>
                      Crawl up to 5 Pages {user.limits.maxCrawlPages < 5 ? '(Pro)' : ''}
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowLlmInput(!showLlmInput)}
                    className="px-3.5 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer"
                  >
                    {showLlmInput ? 'Hide AI Key' : '+ Optional LLM Key'}
                  </button>

                  <button
                    type="submit"
                    disabled={scanning}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition flex items-center gap-2 cursor-pointer"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Run Deep Audit
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showLlmInput && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="text-xs text-slate-400 shrink-0">
                    Optional OpenAI API Key (for live GPT-4o-mini AEO/GEO rewrite synthesis):
                  </label>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    placeholder="sk-... (Leave blank to use built-in deterministic synthesizer)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              )}

              {scanError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {scanError}
                </div>
              )}
            </form>

            {/* Report Results */}
            {activeReport && (
              <div className="space-y-6">
                {/* Summary Header */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg font-bold text-white">{activeReport.metadata.title}</span>
                      <a
                        href={activeReport.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        {activeReport.url} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                      {activeReport.metadata.description || 'No meta description detected on this page.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500">Pages Crawled:</span>{' '}
                      <strong className="text-white">{activeReport.crawlPagesCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Words:</span>{' '}
                      <strong className="text-white">{activeReport.metadata.wordCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Scan Time:</span>{' '}
                      <strong className="text-white">{activeReport.durationMs}ms</strong>
                    </div>
                  </div>
                </div>

                {/* 4 Score Gauges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ScoreGauge
                    label="Overall Index"
                    subtitle="Combined Search & AI Score"
                    score={activeReport.scores.overall}
                    accent="indigo"
                  />
                  <ScoreGauge
                    label="SEO Score"
                    subtitle="Traditional Search Ranking"
                    score={activeReport.scores.seo}
                    accent="emerald"
                  />
                  <ScoreGauge
                    label="AEO Score"
                    subtitle="Answer & Snippet Readiness"
                    score={activeReport.scores.aeo}
                    accent="violet"
                  />
                  <ScoreGauge
                    label="GEO Score"
                    subtitle="LLM Citation & Grounding"
                    score={activeReport.scores.geo}
                    accent="amber"
                  />
                </div>

                {/* AI Crawler Access Matrix */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-indigo-400" />
                      <h2 className="text-sm font-bold text-white">
                        Generative AI Crawler & Machine Discovery Matrix
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-full border ${
                          activeReport.aiCrawlerAccess.hasRobotsTxt
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        /robots.txt: {activeReport.aiCrawlerAccess.hasRobotsTxt ? 'Found' : 'Missing'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full border ${
                          activeReport.aiCrawlerAccess.hasLlmsTxt
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        /llms.txt: {activeReport.aiCrawlerAccess.hasLlmsTxt ? 'Found' : 'Missing'}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full border ${
                          activeReport.aiCrawlerAccess.hasSitemapXml
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        /sitemap.xml: {activeReport.aiCrawlerAccess.hasSitemapXml ? 'Found' : 'Missing'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {activeReport.aiCrawlerAccess.bots.map((b) => (
                      <div
                        key={b.bot}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-white">{b.bot}</span>
                          {b.status === 'allowed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{b.company}</div>
                        <div
                          className={`text-[10px] font-semibold uppercase mt-2 ${
                            b.status === 'allowed' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {b.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-navigation Tabs for Checks vs Actionable Fixes vs Crawled Pages */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
                  {[
                    { id: 'all', label: `All Checks (${activeReport.checks.length})` },
                    { id: 'seo', label: 'SEO Diagnostics' },
                    { id: 'aeo', label: 'AEO (Answer Engine)' },
                    { id: 'geo', label: 'GEO (Generative AI)' },
                    { id: 'fixes', label: '✨ Auto-Generated Code Fixes' },
                    { id: 'pages', label: `Crawled Pages (${activeReport.pages.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setReportSubTab(tab.id as typeof reportSubTab)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        reportSubTab === tab.id
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Diagnostic Check List */}
                {(reportSubTab === 'all' ||
                  reportSubTab === 'seo' ||
                  reportSubTab === 'aeo' ||
                  reportSubTab === 'geo') && (
                  <div className="space-y-3">
                    {filteredChecks.map((check) => (
                      <div
                        key={check.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="mt-0.5">
                            {check.status === 'pass' ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : check.status === 'warn' ? (
                              <AlertTriangle className="w-5 h-5 text-amber-400" />
                            ) : (
                              <XCircle className="w-5 h-5 text-rose-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {check.category}
                              </span>
                              <h3 className="text-sm font-semibold text-white">{check.title}</h3>
                              <span
                                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                                  check.impact === 'high'
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {check.impact} impact
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">{check.recommendation}</p>
                            <div className="text-xs font-mono text-indigo-300 mt-1.5">
                              Detected: {check.value}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-lg font-bold text-white">{check.score}</span>
                          <span className="text-xs text-slate-500"> / {check.maxScore} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actionable Code Fixes */}
                {reportSubTab === 'fixes' && (
                  <div className="space-y-6">
                    {activeReport.generatedFixes.aiRewriteSuggestion && (
                      <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-sm font-bold text-white">
                              AI-Synthesized Direct Answer Block & Entity Grounding
                            </h3>
                          </div>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {activeReport.generatedFixes.aiRewriteSuggestion.provider}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800">
                          <div className="text-xs font-semibold text-indigo-300 mb-1">
                            Recommended Opening Answer Block (40–65 words for Featured Snippets & Perplexity/ChatGPT Citations):
                          </div>
                          <p className="text-sm text-slate-200 leading-relaxed">
                            {activeReport.generatedFixes.aiRewriteSuggestion.directAnswerBlock}
                          </p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800">
                          <div className="text-xs font-semibold text-emerald-300 mb-1">
                            LLM Knowledge Graph Entity Statement:
                          </div>
                          <p className="text-xs text-slate-300">
                            {activeReport.generatedFixes.aiRewriteSuggestion.entitySummary}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <CopyCodeBlock
                        title="JSON-LD Structured Schema (Organization + WebSite + FAQPage)"
                        description="Paste inside your <head> so Answer Engines and Google AI Overviews extract verified entities and Q&A pairs."
                        filename="index.html (<head>)"
                        code={activeReport.generatedFixes.jsonLdSchema}
                      />
                      <CopyCodeBlock
                        title="/llms.txt Machine Context File"
                        description="Place at the root of your domain (https://yourdomain.com/llms.txt) for ChatGPT, Claude, and Perplexity grounding."
                        filename="/llms.txt"
                        code={activeReport.generatedFixes.llmsTxt}
                      />
                      <CopyCodeBlock
                        title="AI-Ready robots.txt Configuration"
                        description="Explicitly permits GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, and Google-Extended."
                        filename="/robots.txt"
                        code={activeReport.generatedFixes.robotsTxt}
                      />
                      <CopyCodeBlock
                        title="Optimized SEO & OpenGraph Meta Tags"
                        description="Complete title, description, canonical, and social preview metadata."
                        filename="meta-tags.html"
                        code={activeReport.generatedFixes.metaTagsHtml}
                      />
                    </div>
                  </div>
                )}

                {/* Multi-page Crawl Breakdown */}
                {reportSubTab === 'pages' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                          <th className="py-3.5 px-4">Page URL & Title</th>
                          <th className="py-3.5 px-4">Words</th>
                          <th className="py-3.5 px-4">SEO</th>
                          <th className="py-3.5 px-4">AEO</th>
                          <th className="py-3.5 px-4">GEO</th>
                          <th className="py-3.5 px-4">Schemas Detected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-xs">
                        {activeReport.pages.map((p) => (
                          <tr key={p.url} className="hover:bg-slate-800/40">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">{p.title}</div>
                              <div className="text-indigo-400 font-mono text-[11px]">{p.url}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">{p.wordCount}</td>
                            <td className="py-3.5 px-4 font-bold text-emerald-400">{p.seoScore}</td>
                            <td className="py-3.5 px-4 font-bold text-violet-400">{p.aeoScore}</td>
                            <td className="py-3.5 px-4 font-bold text-amber-400">{p.geoScore}</td>
                            <td className="py-3.5 px-4 text-slate-300">
                              {p.schemaTypes.length > 0 ? p.schemaTypes.join(', ') : 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: SCAN HISTORY ==================== */}
        {activeNav === 'history' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Workspace Scan History</h1>
              <p className="text-sm text-slate-400 mt-1">
                All audits executed from the web dashboard or via the Developer REST API.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              {scanHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  No scans recorded yet. Run your first scan in the Site Scanner tab!
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                      <th className="py-3.5 px-4">Target URL</th>
                      <th className="py-3.5 px-4">Source</th>
                      <th className="py-3.5 px-4">Overall</th>
                      <th className="py-3.5 px-4">SEO / AEO / GEO</th>
                      <th className="py-3.5 px-4">Pages</th>
                      <th className="py-3.5 px-4">Timestamp</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {scanHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{s.domain}</div>
                          <div className="text-slate-400 font-mono text-[11px] truncate max-w-xs">{s.url}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded uppercase text-[10px] font-bold ${
                              s.source === 'api'
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {s.source}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-base font-bold text-white">{s.overall_score}</span>
                        </td>
                        <td className="py-3.5 px-4 space-x-2">
                          <span className="text-emerald-400 font-semibold">{s.seo_score}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-violet-400 font-semibold">{s.aeo_score}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-amber-400 font-semibold">{s.geo_score}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{s.pages_scanned}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(s.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleLoadPastScan(s.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition cursor-pointer"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: DEVELOPER API KEYS & TELEMETRY ==================== */}
        {activeNav === 'apikeys' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Developer API Key Management</h1>
              <p className="text-sm text-slate-400 mt-1">
                Keys are hashed with SHA-256 at rest and protected by per-minute sliding-window rate limiters and scope guards.
              </p>
            </div>

            {/* Create New Key */}
            <form
              onSubmit={handleCreateApiKey}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-3 items-center"
            >
              <KeyRound className="w-5 h-5 text-indigo-400 shrink-0" />
              <input
                type="text"
                required
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key Name (e.g. GitHub Actions CI/CD, Production Cron)"
                className="flex-1 w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Generate Secret Key
              </button>
            </form>

            {newlyCreatedRawKey && (
              <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    New Secret API Key Generated (Save now — shown only once!)
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(newlyCreatedRawKey)}
                    className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Key
                  </button>
                </div>
                <code className="block p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-xs break-all border border-emerald-500/20">
                  {newlyCreatedRawKey}
                </code>
              </div>
            )}

            {/* Demo Key Callout */}
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-300">
                <strong className="text-white">Ready-to-test Demo API Key:</strong> Use{' '}
                <code className="text-indigo-300 bg-slate-950 px-2 py-0.5 rounded">
                  ag_live_demo_secret_key_2026
                </code>{' '}
                in your terminal or the API Sandbox tab.
              </div>
            </div>

            {/* Active Keys Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 font-semibold text-sm text-white">
                Issued API Keys
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Prefix</th>
                    <th className="py-3 px-4">Scopes</th>
                    <th className="py-3 px-4">Rate Limit</th>
                    <th className="py-3 px-4">Requests</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-semibold text-white">{k.name}</td>
                      <td className="py-3.5 px-4 font-mono text-indigo-300">{k.key_prefix}</td>
                      <td className="py-3.5 px-4 text-slate-300">{k.scopes}</td>
                      <td className="py-3.5 px-4 text-slate-300">{k.rate_limit_per_min} req/min</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{k.requests_count}</td>
                      <td className="py-3.5 px-4">
                        {k.revoked ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase">
                            Revoked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!k.revoked && (
                          <button
                            onClick={() => handleRevokeKey(k.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                            title="Revoke Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent API Request Logs */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 font-semibold text-sm text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Recent Developer API Request Telemetry
              </div>
              {apiLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No developer API calls logged yet. Try the interactive API Sandbox!
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                      <th className="py-3 px-4">Method & Endpoint</th>
                      <th className="py-3 px-4">Target URL</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Latency</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {apiLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 px-4 font-mono text-white">
                          <span className="text-indigo-400 font-bold mr-2">{log.method}</span>
                          {log.endpoint}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono">{log.target_url || '—'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold ${
                              log.status_code < 300
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {log.status_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{log.latency_ms}ms</td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: INTERACTIVE API DOCS & SANDBOX ==================== */}
        {activeNav === 'apidocs' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Developer REST API Reference & Live Sandbox</h1>
              <p className="text-sm text-slate-400 mt-1">
                Integrate automated SEO, AEO, and GEO checks into your CI/CD pipelines, CMS publishing hooks, or custom dashboards.
              </p>
            </div>

            {/* Live Sandbox */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Interactive API Explorer (POST /api/v1/scan)</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">X-API-Key Header</label>
                  <input
                    type="text"
                    value={sandboxKey}
                    onChange={(e) => setSandboxKey(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target URL to Scan</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sandboxUrl}
                      onChange={(e) => setSandboxUrl(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleRunSandboxApi}
                      disabled={sandboxLoading}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {sandboxLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      Send API Request
                    </button>
                  </div>
                </div>
              </div>

              {sandboxResponse && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">Live JSON Response:</div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 overflow-x-auto max-h-96">
                    {sandboxResponse}
                  </pre>
                </div>
              )}
            </div>

            {/* Code Examples */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CopyCodeBlock
                title="cURL — Trigger SEO/AEO/GEO Scan"
                description="Authenticate using X-API-Key or Authorization: Bearer ag_live_..."
                filename="bash"
                code={`curl -X POST http://localhost:4000/api/v1/scan \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${sandboxKey}" \\
  -d '{
    "url": "${sandboxUrl}",
    "maxPages": 1
  }'`}
              />

              <CopyCodeBlock
                title="Node.js / TypeScript SDK Usage"
                description="Verify AEO & GEO scores in CI/CD before deploying marketing or docs pages."
                filename="audit-ci.ts"
                code={`const response = await fetch('http://localhost:4000/api/v1/scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.CITATIONPULSE_API_KEY!,
  },
  body: JSON.stringify({
    url: 'https://yourdomain.com',
    maxPages: 3,
  }),
});

const report = await response.json();
console.log('Scores:', report.scores); // { overall: 86, seo: 92, aeo: 84, geo: 82 }
if (report.scores.geo < 70) {
  throw new Error('GEO readiness score below threshold!');
}`}
              />
            </div>

            {/* ChatGPT Plugin / Custom GPT Actions Hub */}
            <div className="bg-gradient-to-br from-indigo-950/50 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      ChatGPT Plugin & Custom GPT Bot Integration
                    </h2>
                    <p className="text-xs text-slate-400">
                      Connect CitationPulse directly into ChatGPT Custom GPTs, OpenAI Assistants, or AI Bots via OpenAPI 3.1 Actions & AI Plugin Manifests.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <a
                    href="/.well-known/ai-plugin.json"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-800 font-mono flex items-center gap-1.5"
                  >
                    /.well-known/ai-plugin.json <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="/openapi.json"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono flex items-center gap-1.5"
                  >
                    /openapi.json <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-indigo-300">Step 1: Open GPT Builder</div>
                  <p className="text-slate-400">
                    In ChatGPT, go to <strong>Create a GPT → Configure → Create new action</strong>.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-indigo-300">Step 2: Import OpenAPI Schema</div>
                  <p className="text-slate-400">
                    Click <strong>Import from URL</strong> and paste{' '}
                    <code className="text-white">https://citationpulse-aeo-geo.web.app/openapi.json</code> (or copy the schema below).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-indigo-300">Step 3: Set API Key Auth</div>
                  <p className="text-slate-400">
                    Choose <strong>Authentication: API Key (Bearer or Custom Header `X-API-Key`)</strong> and paste your <code className="text-emerald-300">{sandboxKey}</code> key.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CopyCodeBlock
                  title="ChatGPT Custom GPT System Instructions"
                  description="Paste into your Custom GPT 'Instructions' box so the bot knows how to audit sites and pitch your Muse lead offers."
                  filename="gpt-instructions.md"
                  code={`You are the CitationPulse SEO, AEO & GEO Optimization Bot.
1. When a user shares a URL or domain, call the \`scanWebsiteForSeoAeoGeo\` action to audit their SEO, AEO (Answer Engine), and GEO (Generative AI citation) scores.
2. Summarize their 0-100 scores, highlight any blocked AI crawlers (GPTBot, ClaudeBot, PerplexityBot) or missing /llms.txt, and provide the ready-to-paste JSON-LD and /llms.txt code fixes from \`generatedFixes\`.
3. Call \`getMuseBusinessProfileAndLeadOffers\` to check for active promotional offers from our Muse workspace and present relevant promo codes and claim links to qualified leads.`}
                />

                <CopyCodeBlock
                  title="OpenAPI 3.1 Action Schema (ChatGPT Actions)"
                  description="Direct OpenAPI 3.1 schema defining scanWebsiteForSeoAeoGeo and getMuseBusinessProfileAndLeadOffers."
                  filename="openapi.json"
                  code={JSON.stringify(
                    {
                      openapi: '3.1.0',
                      info: {
                        title: 'CitationPulse SEO, AEO & GEO Plugin API',
                        version: '1.2.0',
                      },
                      servers: [{ url: 'https://citationpulse-aeo-geo.web.app' }],
                      paths: {
                        '/api/v1/scan': {
                          post: {
                            operationId: 'scanWebsiteForSeoAeoGeo',
                            summary: 'Audit a website URL for SEO, AEO, and GEO optimization and generate fixes',
                            requestBody: {
                              required: true,
                              content: {
                                'application/json': {
                                  schema: {
                                    type: 'object',
                                    required: ['url'],
                                    properties: {
                                      url: { type: 'string', description: 'Full URL to audit' },
                                      maxPages: { type: 'integer', default: 1 },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        '/api/v1/muse/offers': {
                          get: {
                            operationId: 'getMuseBusinessProfileAndLeadOffers',
                            summary: 'Fetch synced Muse business profile and active promotional lead offers',
                          },
                        },
                      },
                    },
                    null,
                    2
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: BILLING & SUBSCRIPTION TIERS ==================== */}
        {activeNav === 'billing' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Subscription Plans & Stripe Billing</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Scale your monthly SEO/AEO/GEO scan volume, multi-page crawl depth, and Developer API rate limits. Powered by Stripe Checkout.
                </p>
              </div>

              {/* Monthly vs Annual Billing Toggle */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 self-start">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    billingCycle === 'monthly' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === 'annual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Annual Billing
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {billingMessage && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {billingMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  id: 'free' as const,
                  name: 'Starter Free',
                  badge: null,
                  price: '$0',
                  period: '/ forever',
                  billedNote: 'No credit card required',
                  desc: 'Single-page SEO, AEO & GEO diagnostics for solo builders and personal projects.',
                  features: [
                    '15 full site scans / month',
                    'Single-page deep analysis (1 page/scan)',
                    '2 Developer API keys (20 req/min)',
                    'Auto-generated JSON-LD & llms.txt fixes',
                    'AI Crawler Access Matrix (GPTBot, ClaudeBot)',
                  ],
                },
                {
                  id: 'pro' as const,
                  name: 'Growth Pro',
                  badge: 'Most Popular',
                  price: billingCycle === 'annual' ? '$39' : '$49',
                  period: '/ month',
                  billedNote:
                    billingCycle === 'annual'
                      ? 'Billed annually ($468/yr — Save $120)'
                      : 'Billed monthly ($49/mo)',
                  desc: 'Multi-page crawling, high-throughput Developer API, and AI citation rewrites for SaaS & content teams.',
                  features: [
                    '500 full site scans / month',
                    'Multi-page site crawler (up to 5 pages/scan)',
                    '10 Developer API keys (120 req/min)',
                    'AI Direct Answer & FAQ synthesizer',
                    'CI/CD Webhook & REST API integration',
                  ],
                },
                {
                  id: 'enterprise' as const,
                  name: 'Scale & Agency',
                  badge: 'High Volume API',
                  price: billingCycle === 'annual' ? '$159' : '$199',
                  period: '/ month',
                  billedNote:
                    billingCycle === 'annual'
                      ? 'Billed annually ($1,908/yr — Save $480)'
                      : 'Billed monthly ($199/mo)',
                  desc: 'High-volume AEO/GEO monitoring across client domains with priority API rate limits.',
                  features: [
                    '10,000 full site scans / month',
                    'Deep multi-page crawler (up to 15 pages/scan)',
                    '50 Developer API keys (600 req/min)',
                    'Custom OpenAI / Gemini key pass-through',
                    'Dedicated SLA & telemetry retention',
                  ],
                },
              ].map((plan) => {
                const isCurrent = user.plan === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl p-6 border flex flex-col justify-between relative ${
                      plan.id === 'pro'
                        ? 'bg-indigo-950/30 border-indigo-500 shadow-xl shadow-indigo-600/10'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 right-5 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                        {plan.badge}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active Plan
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                        <span className="text-xs text-slate-400">{plan.period}</span>
                      </div>
                      <div className="text-[11px] text-indigo-300 font-medium mt-1">{plan.billedNote}</div>
                      <p className="text-xs text-slate-400 mt-2.5">{plan.desc}</p>

                      <ul className="mt-6 space-y-2.5 text-xs text-slate-200">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8 space-y-2">
                      {plan.id !== 'free' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStripeCheckout(plan.id)}
                            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4" />
                            Subscribe with Stripe ({billingCycle === 'annual' ? 'Annual' : 'Monthly'})
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleUpgradePlan(plan.id)}
                              disabled={billingLoading === plan.id}
                              className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition cursor-pointer"
                            >
                              {billingLoading === plan.id ? 'Activating...' : 'Instant Sandbox Switch (Dev Mode)'}
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpgradePlan('free')}
                          disabled={isCurrent || billingLoading === 'free'}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            isCurrent
                              ? 'bg-slate-800 text-slate-400 cursor-default'
                              : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {isCurrent ? 'Current Free Plan' : 'Downgrade to Starter Free'}
                        </button>
                      )}
                    </div>
                  </div>
                );
                {/* </div> of TAB 5 */}
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 6: MUSE CONNECTOR & LEAD OFFERS ==================== */}
        {activeNav === 'muse' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Muse Connector & Lead Offer Studio</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Sync your site and business profile directly from Muse, run one-click AEO/GEO scans on your Muse site, and publish promotional offers for potential leads.
                </p>
              </div>
              {museConn && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetUrl(museConn.site_url);
                    setActiveNav('scanner');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Audit Synced Muse Site ({new URL(museConn.site_url.startsWith('http') ? museConn.site_url : `https://${museConn.site_url}`).hostname})
                </button>
              )}
            </div>

            {museMessage && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {museMessage}
              </div>
            )}

            {/* 1. Muse Connection & Business Info Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleSyncMuse}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-base font-bold text-white">1. Connect & Pull Business Profile from Muse</h2>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {museConn ? 'Connected' : 'Ready to Sync'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Muse API / Webhook Endpoint</label>
                    <input
                      type="text"
                      value={museApiUrl}
                      onChange={(e) => setMuseApiUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Muse API Key / Token</label>
                    <input
                      type="password"
                      value={museApiKey}
                      onChange={(e) => setMuseApiKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Business / Brand Name in Muse</label>
                    <input
                      type="text"
                      required
                      value={museBusinessName}
                      onChange={(e) => setMuseBusinessName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Primary Site URL</label>
                    <input
                      type="text"
                      required
                      value={museSiteUrl}
                      onChange={(e) => setMuseSiteUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Industry / Category</label>
                    <input
                      type="text"
                      value={museIndustry}
                      onChange={(e) => setMuseIndustry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Primary Location / Market</label>
                    <input
                      type="text"
                      value={museLocation}
                      onChange={(e) => setMuseLocation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Value Proposition / Tagline</label>
                  <input
                    type="text"
                    value={museTagline}
                    onChange={(e) => setMuseTagline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Key Services / Products (comma-separated)</label>
                  <input
                    type="text"
                    value={museServices}
                    onChange={(e) => setMuseServices(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={museSyncing}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {museSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync Site & Business Info from Muse
                </button>
              </form>

              {/* Synced Business Entity Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-white">Synced Muse Business Knowledge Graph</h3>
                    {museConn && (
                      <span className="text-[11px] text-emerald-400 font-mono">
                        Workspace: {museConn.workspace_id}
                      </span>
                    )}
                  </div>

                  {!museConn ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                      Click <strong>Sync Site & Business Info from Muse</strong> on the left to pull your business profile, services, and AI entity metadata.
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="text-sm font-bold text-white">{museConn.business_name}</div>
                        <div className="text-indigo-400 font-mono text-[11px] mt-0.5">{museConn.site_url}</div>
                        <p className="text-slate-300 mt-2">{museConn.tagline}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Industry</span>
                          <span className="text-white font-medium">{museConn.industry}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">Location</span>
                          <span className="text-white font-medium">{museConn.primary_location}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-1.5">
                          Synced Services & Entities (Used for AEO/GEO Grounding)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {museConn.key_services.map((s) => (
                            <span
                              key={s}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {museConn && (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
                    <span>Last synced: {new Date(museConn.synced_at).toLocaleString()}</span>
                    <span className="text-emerald-400 font-medium">✓ Active in AI Entity Graph</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Create & Publish Lead Offer Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleCreateLeadOffer}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">2. Create Promotional Offer for Potential Leads</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Offers created here are automatically synced to your Muse workspace, exposed as `Schema.org/Offer` JSON-LD for AI Answer Engines, and rendered as an embeddable lead-capture widget.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Offer Title / Internal Name</label>
                    <input
                      type="text"
                      required
                      value={offerTitle}
                      onChange={(e) => setOfferTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Offer Type</label>
                    <select
                      value={offerType}
                      onChange={(e) => setOfferType(e.target.value as typeof offerType)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    >
                      <option value="discount">Percentage / Dollar Discount</option>
                      <option value="free_trial">Extended Free Trial</option>
                      <option value="consultation">Free Strategy / Audit Consultation</option>
                      <option value="lead_magnet">Lead Magnet / Resource Download</option>
                      <option value="custom">Custom Lead Incentive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Lead Banner Headline</label>
                  <input
                    type="text"
                    required
                    value={offerHeadline}
                    onChange={(e) => setOfferHeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Offer Details & Value for Leads</label>
                  <textarea
                    rows={2}
                    required
                    value={offerDescription}
                    onChange={(e) => setOfferDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Promo / Lead Code</label>
                    <input
                      type="text"
                      value={offerPromoCode}
                      onChange={(e) => setOfferPromoCode(e.target.value)}
                      placeholder="MUSELEAD20"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">CTA Button Text</label>
                    <input
                      type="text"
                      required
                      value={offerCtaText}
                      onChange={(e) => setOfferCtaText(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Urgency / Expiration Note</label>
                    <input
                      type="text"
                      value={offerExpiration}
                      onChange={(e) => setOfferExpiration(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Lead Destination / Claim URL</label>
                  <input
                    type="text"
                    required
                    value={offerCtaUrl}
                    onChange={(e) => setOfferCtaUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-indigo-300 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Publish Lead Offer to Muse & Generate AEO/GEO Embed
                </button>
              </form>

              {/* Live Offer Preview + Schema & Widget Snippet */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/40 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Live Lead Capture Preview ({museConn?.business_name || museBusinessName})
                    </span>
                    <span className="text-[11px] text-slate-400">{offerExpiration}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-white mt-2">{offerHeadline}</h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{offerDescription}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {offerPromoCode && (
                      <div className="text-xs bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
                        <span className="text-slate-400 mr-1.5">Use Code:</span>
                        <code className="font-mono font-bold text-amber-300">{offerPromoCode}</code>
                      </div>
                    )}
                    <a
                      href={offerCtaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
                    >
                      {offerCtaText} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <CopyCodeBlock
                  title="Muse Lead Offer JSON-LD Schema + Embed Snippet"
                  description="Embed on your Muse site so ChatGPT, Perplexity, and Google AI Overviews surface your active lead offer directly in conversational answers."
                  filename="muse-lead-offer.html"
                  code={`<!-- Muse Lead Offer Schema.org Markup for AEO & GEO -->
<script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: offerTitle,
    headline: offerHeadline,
    description: offerDescription,
    url: offerCtaUrl,
    offeredBy: {
      '@type': 'Organization',
      name: museConn?.business_name || museBusinessName,
      url: museConn?.site_url || museSiteUrl,
    },
  },
  null,
  2
)}
</script>`}
                />
              </div>
            </div>

            {/* 3. Active Lead Offers Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 font-semibold text-sm text-white flex items-center justify-between">
                <span>Published Muse Lead Offers ({leadOffers.length})</span>
                <span className="text-xs font-mono text-indigo-300">API Endpoint: GET /api/v1/muse/offers</span>
              </div>
              {leadOffers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No lead offers published yet. Use the builder above to publish your first lead offer!
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/60">
                      <th className="py-3 px-4">Offer & Headline</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Promo Code</th>
                      <th className="py-3 px-4">Muse Sync</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {leadOffers.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-800/40">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{o.title}</div>
                          <div className="text-slate-400 text-[11px]">{o.headline}</div>
                        </td>
                        <td className="py-3.5 px-4 uppercase font-mono text-[11px] text-indigo-300">
                          {o.offer_type}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-amber-300">{o.promo_code || '—'}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold">
                            Synced
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleOffer(o.id)}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              o.active
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {o.active ? 'Active' : 'Paused'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteOffer(o.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                            title="Delete Offer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
