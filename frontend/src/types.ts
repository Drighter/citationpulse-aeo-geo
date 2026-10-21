export interface PlanLimits {
  monthlyScans: number;
  maxCrawlPages: number;
  rateLimitPerMin: number;
  maxApiKeys: number;
  priceMonthly: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  scansUsedThisMonth: number;
  limits: PlanLimits;
}

export interface CheckItem {
  id: string;
  category: 'seo' | 'aeo' | 'geo';
  title: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  maxScore: number;
  value: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
}

export interface PageBreakdown {
  url: string;
  title: string;
  wordCount: number;
  seoScore: number;
  aeoScore: number;
  geoScore: number;
  headingsCount: number;
  questionsFound: string[];
  schemaTypes: string[];
}

export interface GeneratedFixes {
  jsonLdSchema: string;
  llmsTxt: string;
  robotsTxt: string;
  metaTagsHtml: string;
  aiRewriteSuggestion?: {
    provider: string;
    directAnswerBlock: string;
    faqAddition: Array<{ question: string; answer: string }>;
    entitySummary: string;
  };
}

export interface ScanReport {
  id: string;
  source?: string;
  url: string;
  domain: string;
  scannedAt: string;
  durationMs: number;
  crawlPagesCount: number;
  scores: {
    overall: number;
    seo: number;
    aeo: number;
    geo: number;
  };
  metadata: {
    title: string;
    description: string;
    canonical: string | null;
    language: string | null;
    ogImage: string | null;
    wordCount: number;
    readingEaseScore: number;
  };
  aiCrawlerAccess: {
    hasRobotsTxt: boolean;
    hasLlmsTxt: boolean;
    hasSitemapXml: boolean;
    bots: Array<{
      bot: string;
      company: string;
      status: 'allowed' | 'blocked';
    }>;
  };
  checks: CheckItem[];
  pages: PageBreakdown[];
  generatedFixes: GeneratedFixes;
}

export interface ScanSummary {
  id: string;
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
  created_at: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  rate_limit_per_min: number;
  requests_count: number;
  last_used_at: string | null;
  revoked: number;
  created_at: string;
}

export interface ApiLogItem {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  target_url: string | null;
  status_code: number;
  latency_ms: number;
  created_at: string;
}

export interface MuseConnection {
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

export interface LeadOffer {
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
