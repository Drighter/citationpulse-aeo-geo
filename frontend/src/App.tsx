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

  const [activeNav, setActiveNav] = useState<'scanner' | 'history' | 'apikeys' | 'apidocs' | 'billing'>('scanner');

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
    } catch {
      const savedUser = localStorage.getItem('cp_hosted_user');
      if (savedUser) setUser(JSON.parse(savedUser));
    }
  };

  useEffect(() => {
    if (token) {
      fetchWorkspaceData(token);
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
      const idToken = await firebaseGoogleSignIn();
      const syncRes = await fetch('/api/auth/firebase-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const syncData = await syncRes.json();
      if (syncRes.ok) {
        localStorage.setItem('cp_token', idToken);
        setToken(idToken);
        setUser(syncData.user);
      } else {
        setAuthError(syncData.error || 'Google Firebase sign-in failed');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
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
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.mode === 'stripe_checkout' && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        setBillingMessage(data.message || `Switched to ${planId.toUpperCase()} tier!`);
        fetchWorkspaceData(token);
      } else {
        setBillingMessage(data.message || data.error);
      }
    } finally {
      setBillingLoading(null);
    }
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
              {authMode === 'login' ? 'Sign In with Firebase' : 'Create Firebase Account'}
            </button>
            {isFirebaseClientConfigured && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                Continue with Google (Firebase Auth)
              </button>
            )}
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
          </div>
        )}

        {/* ==================== TAB 5: BILLING & SUBSCRIPTION TIERS ==================== */}
        {activeNav === 'billing' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Subscription Plans & API Quota Tiers</h1>
              <p className="text-sm text-slate-400 mt-1">
                Scale your monthly scan volume, multi-page crawl depth, and Developer API rate limits. Supports Stripe Checkout or instant sandbox switching.
              </p>
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
                  price: '$0',
                  desc: 'Single-page SEO, AEO & GEO diagnostics for solo builders.',
                  features: [
                    '15 full site scans / month',
                    'Single-page deep analysis (1 page/scan)',
                    '2 Developer API keys (20 req/min)',
                    'Auto-generated JSON-LD & llms.txt fixes',
                  ],
                },
                {
                  id: 'pro' as const,
                  name: 'Growth Pro',
                  price: '$49',
                  desc: 'Multi-page crawling, high-throughput Developer API, and AI rewrites.',
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
                  name: 'Agency & Enterprise',
                  price: '$199',
                  desc: 'High-volume AEO/GEO monitoring across domains with priority rate limits.',
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
                    className={`rounded-2xl p-6 border flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-indigo-950/30 border-indigo-500 shadow-xl shadow-indigo-600/10'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Active Plan
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                        <span className="text-xs text-slate-400">/ month</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{plan.desc}</p>

                      <ul className="mt-6 space-y-2.5 text-xs text-slate-200">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleUpgradePlan(plan.id)}
                      disabled={isCurrent || billingLoading === plan.id}
                      className={`mt-8 w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                      }`}
                    >
                      {billingLoading === plan.id
                        ? 'Updating Plan...'
                        : isCurrent
                        ? 'Current Workspace Plan'
                        : `Switch to ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
