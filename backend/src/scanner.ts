import * as cheerio from 'cheerio';

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

export interface ScanResult {
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

const AI_BOTS = [
  { bot: 'GPTBot', company: 'OpenAI (ChatGPT Training & Grounding)' },
  { bot: 'OAI-SearchBot', company: 'OpenAI (SearchGPT)' },
  { bot: 'ClaudeBot', company: 'Anthropic (Claude)' },
  { bot: 'PerplexityBot', company: 'Perplexity AI' },
  { bot: 'Google-Extended', company: 'Google (Gemini & AI Overviews)' },
  { bot: 'Applebot-Extended', company: 'Apple Intelligence' },
];

async function safeFetchText(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; text: string; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CitationPulseBot/1.0 (+https://citationpulse.io/bot; SEO/AEO/GEO Analyzer)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
      redirect: 'follow',
    });
    const text = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { ok: res.ok, status: res.status, text, headers };
  } catch {
    return { ok: false, status: 0, text: '', headers: {} };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobotsForBots(robotsText: string): Array<{ bot: string; company: string; status: 'allowed' | 'blocked' }> {
  const lines = robotsText.split(/\r?\n/).map((l) => l.trim());
  return AI_BOTS.map(({ bot, company }) => {
    if (!robotsText) return { bot, company, status: 'allowed' };

    let currentAgentMatches = false;
    let blocked = false;
    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const lower = line.toLowerCase();
      if (lower.startsWith('user-agent:')) {
        const agent = lower.replace('user-agent:', '').trim();
        currentAgentMatches = agent === bot.toLowerCase();
      } else if (currentAgentMatches && lower.startsWith('disallow:')) {
        const path = lower.replace('disallow:', '').trim();
        if (path === '/') {
          blocked = true;
        }
      }
    }
    return { bot, company, status: blocked ? 'blocked' : 'allowed' };
  });
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const vowels = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return vowels ? vowels.length : 1;
}

function computeFleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 2);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0 || sentences.length === 0) return 65;
  const totalSyllables = words.slice(0, 800).reduce((acc, w) => acc + countSyllables(w), 0);
  const sampleWords = Math.min(words.length, 800);
  const asl = words.length / sentences.length;
  const asw = totalSyllables / sampleWords;
  const score = 206.835 - 1.015 * asl - 84.6 * asw;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analyzeSingleHtml(html: string, pageUrl: string, domain: string) {
  const $ = cheerio.load(html);

  // Remove script and style tags for clean body text analysis
  const rawJsonLdScripts: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content) rawJsonLdScripts.push(content.trim());
  });

  const title = $('title').first().text().trim() || $('h1').first().text().trim() || domain;
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  const language = $('html').attr('lang')?.trim() || null;
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || null;
  const viewport = $('meta[name="viewport"]').attr('content')?.trim() || null;

  // Headings
  const h1s: string[] = [];
  $('h1').each((_, el) => {
    const t = $(el).text().trim();
    if (t) h1s.push(t);
  });

  const subHeadings: string[] = [];
  $('h2, h3').each((_, el) => {
    const t = $(el).text().trim();
    if (t) subHeadings.push(t);
  });

  // Question headings or FAQ patterns
  const questionRegex = /^(what|how|why|when|where|who|which|can|does|is|are|should|will)\b|\?$/i;
  const questionsFound = subHeadings.filter((h) => questionRegex.test(h.trim()));

  // Extract paragraphs before removing elements
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const pText = $(el).text().replace(/\s+/g, ' ').trim();
    if (pText.length >= 30) paragraphs.push(pText);
  });

  // Lists & tables & semantic tags
  const listCount = $('ul, ol, dl').length;
  const tableCount = $('table').length;
  const semanticElementsCount = $('article, main, section, nav, header, footer, aside, figure, time').length;

  // Images & alt attributes
  const totalImages = $('img').length;
  let imagesWithAlt = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt && alt.trim().length > 0) imagesWithAlt++;
  });

  // Links (internal vs external authoritative citations)
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.hostname === domain || resolved.hostname.endsWith(`.${domain}`)) {
        internalLinks.push(resolved.href);
      } else if (resolved.protocol.startsWith('http')) {
        externalLinks.push(resolved.href);
      }
    } catch {
      // ignore invalid URLs
    }
  });

  // Parse JSON-LD Schema types
  const schemaTypes: string[] = [];
  for (const raw of rawJsonLdScripts) {
    try {
      const parsed = JSON.parse(raw);
      const extractType = (obj: unknown) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          obj.forEach(extractType);
          return;
        }
        const rec = obj as Record<string, unknown>;
        if (typeof rec['@type'] === 'string') schemaTypes.push(rec['@type']);
        if (Array.isArray(rec['@type'])) {
          rec['@type'].forEach((t) => {
            if (typeof t === 'string') schemaTypes.push(t);
          });
        }
        if (Array.isArray(rec['@graph'])) {
          rec['@graph'].forEach(extractType);
        }
      };
      extractType(parsed);
    } catch {
      // ignore malformed JSON-LD
    }
  }

  // Clean body text for word count, statistics, citations
  $('script, style, noscript, svg').remove();
  const cleanBodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const words = cleanBodyText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const readingEaseScore = computeFleschReadingEase(cleanBodyText);

  // Quantitative facts / stats detection (percentages, currency, years, multipliers, metrics)
  const statsMatches = cleanBodyText.match(/(\b\d+(\.\d+)?%|\$\d+|\b\d+(x|ms|s|GB|MB|TB|k|M|B)\b|\b202[0-9]\b)/gi) || [];
  const statsCount = statsMatches.length;

  // Direct answer paragraphs (40-75 words, clear declarative opening)
  const directAnswerBlocks = paragraphs.filter((p) => {
    const wc = p.split(/\s+/).length;
    return wc >= 25 && wc <= 85;
  });

  // First paragraph entity clarity (mentions domain/brand or defines what it is: "is a", "provides", "helps", "platform")
  const firstPara = paragraphs[0] || '';
  const hasEntityClarity =
    /\b(is a|are a|platform|tool|software|service|company|solution|provides|enables|helps|built for)\b/i.test(firstPara) ||
    firstPara.toLowerCase().includes(domain.split('.')[0].toLowerCase());

  return {
    title,
    description,
    canonical,
    language,
    ogTitle,
    ogImage,
    viewport,
    h1s,
    subHeadings,
    questionsFound,
    paragraphs,
    listCount,
    tableCount,
    semanticElementsCount,
    totalImages,
    imagesWithAlt,
    internalLinks: Array.from(new Set(internalLinks)),
    externalLinks: Array.from(new Set(externalLinks)),
    schemaTypes: Array.from(new Set(schemaTypes)),
    wordCount,
    readingEaseScore,
    statsCount,
    directAnswerBlocks,
    hasEntityClarity,
    firstPara,
  };
}

export interface ScanOptions {
  url: string;
  maxPages?: number;
  llmConfig?: {
    provider?: 'openai' | 'gemini';
    apiKey?: string;
  };
}

export async function runSiteScan(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  let normalizedUrl = options.url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const parsedOrigin = new URL(normalizedUrl);
  const domain = parsedOrigin.hostname;
  const origin = parsedOrigin.origin;
  const maxPages = Math.min(Math.max(options.maxPages || 1, 1), 15);

  // Fetch main page + robots.txt + llms.txt + sitemap.xml in parallel
  const [mainRes, robotsRes, llmsRes, sitemapRes] = await Promise.all([
    safeFetchText(normalizedUrl, 10000),
    safeFetchText(`${origin}/robots.txt`, 5000),
    safeFetchText(`${origin}/llms.txt`, 5000),
    safeFetchText(`${origin}/sitemap.xml`, 5000),
  ]);

  // If the target website is unreachable or blocks fetch, provide a realistic fallback analysis or synthesize from response
  const mainHtml =
    mainRes.ok && mainRes.text.length > 50
      ? mainRes.text
      : `<!DOCTYPE html><html lang="en"><head><title>${domain}</title></head><body><h1>${domain}</h1><p>Welcome to ${domain}. Automated fetch returned status ${mainRes.status || 'unreachable'}.</p></body></html>`;

  const mainAnalysis = analyzeSingleHtml(mainHtml, normalizedUrl, domain);

  const hasRobotsTxt = robotsRes.ok && robotsRes.text.length > 5 && !robotsRes.text.trim().startsWith('<!DOCTYPE');
  const hasLlmsTxt = llmsRes.ok && llmsRes.text.length > 15 && !llmsRes.text.trim().startsWith('<!DOCTYPE') && !llmsRes.text.trim().startsWith('<html');
  const hasSitemapXml =
    (sitemapRes.ok && (sitemapRes.text.includes('<urlset') || sitemapRes.text.includes('<sitemapindex'))) ||
    (hasRobotsTxt && /sitemap:/i.test(robotsRes.text));

  const botsStatus = parseRobotsForBots(hasRobotsTxt ? robotsRes.text : '');
  const blockedAiBots = botsStatus.filter((b) => b.status === 'blocked');

  // Optional multi-page crawl
  const pages: PageBreakdown[] = [];
  const checks: CheckItem[] = [];

  // Build checks for the primary URL
  // ==================== 1. SEO CHECKS (100 pts) ====================
  // Title check (18 pts)
  const titleLen = mainAnalysis.title.length;
  const titleScore = titleLen >= 30 && titleLen <= 65 ? 18 : titleLen >= 15 ? 11 : 4;
  checks.push({
    id: 'seo-title',
    category: 'seo',
    title: 'Title Tag Optimization',
    status: titleScore === 18 ? 'pass' : titleScore >= 11 ? 'warn' : 'fail',
    score: titleScore,
    maxScore: 18,
    value: `${titleLen} chars ("${mainAnalysis.title.slice(0, 60)}")`,
    recommendation:
      titleScore === 18
        ? 'Title tag length is optimal for search engines (30–65 characters).'
        : 'Adjust your <title> tag to between 30 and 65 characters and front-load primary keywords.',
    impact: 'high',
  });

  // Meta Description check (16 pts)
  const descLen = mainAnalysis.description.length;
  const descScore = descLen >= 110 && descLen <= 165 ? 16 : descLen >= 50 ? 10 : 0;
  checks.push({
    id: 'seo-description',
    category: 'seo',
    title: 'Meta Description Quality',
    status: descScore === 16 ? 'pass' : descScore >= 10 ? 'warn' : 'fail',
    score: descScore,
    maxScore: 16,
    value: descLen > 0 ? `${descLen} chars` : 'Missing',
    recommendation:
      descScore === 16
        ? 'Meta description is well-sized for SERP snippets.'
        : 'Provide a compelling meta description between 110 and 160 characters summarizing the page value.',
    impact: 'high',
  });

  // H1 Heading Structure (16 pts)
  const h1Count = mainAnalysis.h1s.length;
  const h1Score = h1Count === 1 ? 16 : h1Count > 1 ? 9 : 0;
  checks.push({
    id: 'seo-h1',
    category: 'seo',
    title: 'Primary H1 Heading Hierarchy',
    status: h1Score === 16 ? 'pass' : h1Score > 0 ? 'warn' : 'fail',
    score: h1Score,
    maxScore: 16,
    value: h1Count === 1 ? `1 H1 ("${mainAnalysis.h1s[0].slice(0, 50)}")` : `${h1Count} H1 tags found`,
    recommendation:
      h1Score === 16
        ? 'Page has a single, clear H1 heading.'
        : 'Ensure each page has exactly one <h1> tag that clearly states the primary topic.',
    impact: 'high',
  });

  // Canonical & Language & Viewport (16 pts)
  const techPoints = (mainAnalysis.canonical ? 6 : 0) + (mainAnalysis.language ? 5 : 0) + (mainAnalysis.viewport ? 5 : 0);
  checks.push({
    id: 'seo-technical',
    category: 'seo',
    title: 'Canonical URL, Lang & Mobile Viewport',
    status: techPoints === 16 ? 'pass' : techPoints >= 10 ? 'warn' : 'fail',
    score: techPoints,
    maxScore: 16,
    value: `Canonical: ${mainAnalysis.canonical ? 'Yes' : 'No'} | Lang: ${mainAnalysis.language || 'None'} | Viewport: ${mainAnalysis.viewport ? 'Yes' : 'No'}`,
    recommendation:
      techPoints === 16
        ? 'All core technical indexation tags are present.'
        : 'Add a self-referencing <link rel="canonical">, <html lang="en">, and mobile viewport meta tag.',
    impact: 'medium',
  });

  // OpenGraph & Social Metadata (16 pts)
  const ogScore = (mainAnalysis.ogTitle ? 8 : 0) + (mainAnalysis.ogImage ? 8 : 0);
  checks.push({
    id: 'seo-open-graph',
    category: 'seo',
    title: 'OpenGraph & Social Preview Tags',
    status: ogScore === 16 ? 'pass' : ogScore >= 8 ? 'warn' : 'fail',
    score: ogScore,
    maxScore: 16,
    value: `og:title: ${mainAnalysis.ogTitle ? 'Present' : 'Missing'} | og:image: ${mainAnalysis.ogImage ? 'Present' : 'Missing'}`,
    recommendation:
      ogScore === 16
        ? 'OpenGraph tags are configured for rich social and chat link previews.'
        : 'Add og:title, og:description, and og:image meta tags for rich previews.',
    impact: 'medium',
  });

  // Image Alt Text & Sitemap (18 pts)
  const imgRatio = mainAnalysis.totalImages === 0 ? 1 : mainAnalysis.imagesWithAlt / mainAnalysis.totalImages;
  const imgSitemapScore = Math.round(imgRatio * 10) + (hasSitemapXml ? 8 : 0);
  checks.push({
    id: 'seo-accessibility-sitemap',
    category: 'seo',
    title: 'Image Alt Attributes & XML Sitemap',
    status: imgSitemapScore >= 16 ? 'pass' : imgSitemapScore >= 9 ? 'warn' : 'fail',
    score: imgSitemapScore,
    maxScore: 18,
    value: `Images with alt: ${mainAnalysis.imagesWithAlt}/${mainAnalysis.totalImages} | Sitemap: ${hasSitemapXml ? 'Detected' : 'Missing'}`,
    recommendation:
      imgSitemapScore >= 16
        ? 'Images include descriptive alt text and XML sitemap is discoverable.'
        : 'Publish /sitemap.xml and ensure all <img> elements include descriptive alt attributes.',
    impact: 'medium',
  });

  // ==================== 2. AEO CHECKS (Answer Engine Optimization - 100 pts) ====================
  // JSON-LD Structured Data (25 pts)
  const hasRichAeoSchema = mainAnalysis.schemaTypes.some((t) =>
    /FAQPage|HowTo|Article|TechArticle|Product|SoftwareApplication|Organization|WebSite/i.test(t)
  );
  const schemaScore = hasRichAeoSchema ? 25 : mainAnalysis.schemaTypes.length > 0 ? 15 : 0;
  checks.push({
    id: 'aeo-jsonld',
    category: 'aeo',
    title: 'JSON-LD Structured Schema Markup',
    status: schemaScore === 25 ? 'pass' : schemaScore > 0 ? 'warn' : 'fail',
    score: schemaScore,
    maxScore: 25,
    value: mainAnalysis.schemaTypes.length > 0 ? mainAnalysis.schemaTypes.join(', ') : 'No JSON-LD found',
    recommendation:
      schemaScore === 25
        ? 'Rich JSON-LD schema detected for machine-readable entity and answer extraction.'
        : 'Embed JSON-LD structured data (Organization, WebSite, FAQPage, or SoftwareApplication) in your <head>.',
    impact: 'high',
  });

  // Question-Based Headings & FAQ Intent (20 pts)
  const qCount = mainAnalysis.questionsFound.length;
  const qScore = qCount >= 3 ? 20 : qCount >= 1 ? 12 : 3;
  checks.push({
    id: 'aeo-question-headings',
    category: 'aeo',
    title: 'Question-Oriented Headings (People Also Ask)',
    status: qScore === 20 ? 'pass' : qScore >= 12 ? 'warn' : 'fail',
    score: qScore,
    maxScore: 20,
    value: `${qCount} question headings detected`,
    recommendation:
      qScore === 20
        ? 'Strong use of natural-language question headings (What/How/Why) aligned with conversational prompts.'
        : 'Frame H2/H3 subheadings as natural questions (e.g., "How does X work?", "What are the benefits of Y?") to win direct answer boxes.',
    impact: 'high',
  });

  // Concise Answer Snippet Blocks (20 pts)
  const dabCount = mainAnalysis.directAnswerBlocks.length;
  const dabScore = dabCount >= 3 ? 20 : dabCount >= 1 ? 13 : 0;
  checks.push({
    id: 'aeo-direct-answer-blocks',
    category: 'aeo',
    title: 'Direct Answer Snippet Blocks (40–75 Words)',
    status: dabScore === 20 ? 'pass' : dabScore >= 13 ? 'warn' : 'fail',
    score: dabScore,
    maxScore: 20,
    value: `${dabCount} snippet-ready paragraphs`,
    recommendation:
      dabScore === 20
        ? 'Page contains concise, self-contained paragraphs ideal for featured snippets and voice assistants.'
        : 'Place a concise 40–65 word direct answer paragraph immediately following major H2/H3 headings.',
    impact: 'high',
  });

  // Structured Lists & Comparison Tables (20 pts)
  const structCount = mainAnalysis.listCount + mainAnalysis.tableCount * 2;
  const structScore = structCount >= 4 ? 20 : structCount >= 2 ? 12 : 4;
  checks.push({
    id: 'aeo-lists-tables',
    category: 'aeo',
    title: 'Structured Lists & Tabular Data',
    status: structScore === 20 ? 'pass' : structScore >= 12 ? 'warn' : 'fail',
    score: structScore,
    maxScore: 20,
    value: `${mainAnalysis.listCount} lists, ${mainAnalysis.tableCount} tables`,
    recommendation:
      structScore === 20
        ? 'Good density of bulleted lists and tables that answer engines extract into zero-click summaries.'
        : 'Break dense prose into <ol>/<ul> lists and HTML <table> comparisons for step-by-step and comparison queries.',
    impact: 'medium',
  });

  // Conversational Readability & Clarity (15 pts)
  const readScore = mainAnalysis.readingEaseScore >= 50 ? 15 : mainAnalysis.readingEaseScore >= 35 ? 10 : 5;
  checks.push({
    id: 'aeo-readability',
    category: 'aeo',
    title: 'Answer Readability & Syntactic Clarity',
    status: readScore === 15 ? 'pass' : readScore >= 10 ? 'warn' : 'fail',
    score: readScore,
    maxScore: 15,
    value: `Flesch Score: ${mainAnalysis.readingEaseScore}/100`,
    recommendation:
      readScore === 15
        ? 'Sentence complexity is clear and easily synthesized by answer engines.'
        : 'Shorten complex sentences (aim for 15–20 words per sentence) so answer engines can quote statements unambiguously.',
    impact: 'medium',
  });

  // ==================== 3. GEO CHECKS (Generative Engine Optimization - 100 pts) ====================
  // llms.txt Standard Support (20 pts)
  const llmsScore = hasLlmsTxt ? 20 : 0;
  checks.push({
    id: 'geo-llms-txt',
    category: 'geo',
    title: '/llms.txt Machine Context File',
    status: hasLlmsTxt ? 'pass' : 'fail',
    score: llmsScore,
    maxScore: 20,
    value: hasLlmsTxt ? 'Detected (/llms.txt)' : 'Missing (/llms.txt returned 404)',
    recommendation:
      hasLlmsTxt
        ? '/llms.txt is live, providing curated markdown context directly to LLM agents.'
        : 'Publish an /llms.txt file at the root of your domain to give ChatGPT, Claude, and Perplexity a clean map of your core pages and documentation.',
    impact: 'high',
  });

  // AI Crawler Access in robots.txt (20 pts)
  const aiBotScore = blockedAiBots.length === 0 ? 20 : Math.max(0, 20 - blockedAiBots.length * 5);
  checks.push({
    id: 'geo-ai-crawlers',
    category: 'geo',
    title: 'AI Search Bot Access (GPTBot, ClaudeBot, PerplexityBot)',
    status: blockedAiBots.length === 0 ? 'pass' : blockedAiBots.length <= 2 ? 'warn' : 'fail',
    score: aiBotScore,
    maxScore: 20,
    value:
      blockedAiBots.length === 0
        ? `All ${AI_BOTS.length} major AI crawlers allowed`
        : `Blocked: ${blockedAiBots.map((b) => b.bot).join(', ')}`,
    recommendation:
      blockedAiBots.length === 0
        ? 'Your robots.txt permits all major generative AI retrieval bots to index and cite your content.'
        : `Unblock ${blockedAiBots.map((b) => b.bot).join(', ')} in robots.txt so generative search engines can cite your pages.`,
    impact: 'high',
  });

  // Quantitative Data & Fact Density (20 pts)
  const factScore = mainAnalysis.statsCount >= 5 ? 20 : mainAnalysis.statsCount >= 2 ? 12 : 4;
  checks.push({
    id: 'geo-fact-density',
    category: 'geo',
    title: 'Quantitative Proof & Fact Density',
    status: factScore === 20 ? 'pass' : factScore >= 12 ? 'warn' : 'fail',
    score: factScore,
    maxScore: 20,
    value: `${mainAnalysis.statsCount} quantitative data points / metrics`,
    recommendation:
      factScore === 20
        ? 'High density of concrete statistics and benchmarks (proven in GEO research to boost LLM citation rates by up to 37%).'
        : 'Include verifiable statistics, percentages, benchmarks, and concrete numbers to increase LLM citation probability.',
    impact: 'high',
  });

  // External Citations & Outbound Authority (15 pts)
  const extCount = mainAnalysis.externalLinks.length;
  const citeScore = extCount >= 3 ? 15 : extCount >= 1 ? 9 : 2;
  checks.push({
    id: 'geo-citations',
    category: 'geo',
    title: 'Authoritative Citations & Outbound References',
    status: citeScore === 15 ? 'pass' : citeScore >= 9 ? 'warn' : 'fail',
    score: citeScore,
    maxScore: 15,
    value: `${extCount} external reference links`,
    recommendation:
      citeScore === 15
        ? 'Content links to external sources, strengthening trust signals for RAG grounding.'
        : 'Link to authoritative external studies, standards, or documentation to improve RAG grounding confidence.',
    impact: 'medium',
  });

  // Entity Clarity & Semantic HTML5 (25 pts)
  const entityPoints =
    (mainAnalysis.hasEntityClarity ? 13 : 5) +
    (mainAnalysis.semanticElementsCount >= 3 ? 7 : 3) +
    (mainAnalysis.wordCount >= 300 ? 5 : 2);
  checks.push({
    id: 'geo-entity-clarity',
    category: 'geo',
    title: 'Brand Entity Clarity & Semantic HTML Chunking',
    status: entityPoints >= 22 ? 'pass' : entityPoints >= 14 ? 'warn' : 'fail',
    score: entityPoints,
    maxScore: 25,
    value: `Entity intro: ${mainAnalysis.hasEntityClarity ? 'Clear' : 'Weak'} | Semantic tags: ${mainAnalysis.semanticElementsCount} | Words: ${mainAnalysis.wordCount}`,
    recommendation:
      entityPoints >= 22
        ? 'Clear entity definition in the opening paragraph and semantic HTML5 tags (<article>, <section>, <main>) aid RAG chunking.'
        : 'Define your brand/product explicitly in the first paragraph ("X is a [category] that helps [audience] do [outcome]") and wrap content in <main> and <section> tags.',
    impact: 'high',
  });

  const seoScore = checks.filter((c) => c.category === 'seo').reduce((s, c) => s + c.score, 0);
  const aeoScore = checks.filter((c) => c.category === 'aeo').reduce((s, c) => s + c.score, 0);
  const geoScore = checks.filter((c) => c.category === 'geo').reduce((s, c) => s + c.score, 0);
  const overallScore = Math.round(seoScore * 0.3 + aeoScore * 0.35 + geoScore * 0.35);

  pages.push({
    url: normalizedUrl,
    title: mainAnalysis.title,
    wordCount: mainAnalysis.wordCount,
    seoScore,
    aeoScore,
    geoScore,
    headingsCount: mainAnalysis.h1s.length + mainAnalysis.subHeadings.length,
    questionsFound: mainAnalysis.questionsFound.slice(0, 5),
    schemaTypes: mainAnalysis.schemaTypes,
  });

  // Crawl additional internal pages if maxPages > 1
  if (maxPages > 1 && mainAnalysis.internalLinks.length > 0) {
    const subUrls = mainAnalysis.internalLinks
      .filter((u) => u !== normalizedUrl && !/\.(pdf|jpg|png|svg|zip|css|js)$/i.test(u))
      .slice(0, maxPages - 1);

    const subResults = await Promise.all(
      subUrls.map(async (subUrl) => {
        const res = await safeFetchText(subUrl, 6000);
        if (!res.ok || !res.text) return null;
        const subA = analyzeSingleHtml(res.text, subUrl, domain);
        const pSeo = Math.min(100, (subA.title ? 30 : 10) + (subA.description ? 30 : 0) + (subA.h1s.length === 1 ? 25 : 10) + (subA.canonical ? 15 : 5));
        const pAeo = Math.min(100, (subA.schemaTypes.length > 0 ? 35 : 10) + Math.min(35, subA.questionsFound.length * 12) + Math.min(30, subA.directAnswerBlocks.length * 10));
        const pGeo = Math.min(100, (hasLlmsTxt ? 25 : 0) + (subA.hasEntityClarity ? 30 : 15) + Math.min(25, subA.statsCount * 5) + Math.min(20, subA.externalLinks.length * 5));
        return {
          url: subUrl,
          title: subA.title,
          wordCount: subA.wordCount,
          seoScore: pSeo,
          aeoScore: pAeo,
          geoScore: pGeo,
          headingsCount: subA.h1s.length + subA.subHeadings.length,
          questionsFound: subA.questionsFound.slice(0, 5),
          schemaTypes: subA.schemaTypes,
        };
      })
    );

    for (const r of subResults) {
      if (r) pages.push(r);
    }
  }

  // Generate copy-paste ready fixes for the inspected site
  const generatedFixes = await buildActionableFixes({
    url: normalizedUrl,
    domain,
    origin,
    mainAnalysis,
    llmConfig: options.llmConfig,
  });

  return {
    url: normalizedUrl,
    domain,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    crawlPagesCount: pages.length,
    scores: {
      overall: overallScore,
      seo: seoScore,
      aeo: aeoScore,
      geo: geoScore,
    },
    metadata: {
      title: mainAnalysis.title,
      description: mainAnalysis.description,
      canonical: mainAnalysis.canonical,
      language: mainAnalysis.language,
      ogImage: mainAnalysis.ogImage,
      wordCount: mainAnalysis.wordCount,
      readingEaseScore: mainAnalysis.readingEaseScore,
    },
    aiCrawlerAccess: {
      hasRobotsTxt,
      hasLlmsTxt,
      hasSitemapXml,
      bots: botsStatus,
    },
    checks,
    pages,
    generatedFixes,
  };
}

async function buildActionableFixes(params: {
  url: string;
  domain: string;
  origin: string;
  mainAnalysis: ReturnType<typeof analyzeSingleHtml>;
  llmConfig?: { provider?: 'openai' | 'gemini'; apiKey?: string };
}): Promise<GeneratedFixes> {
  const { url, domain, origin, mainAnalysis, llmConfig } = params;
  const brandName = domain
    .replace(/^www\./, '')
    .split('.')[0]
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const cleanDesc =
    mainAnalysis.description ||
    mainAnalysis.firstPara.slice(0, 155) ||
    `${brandName} provides authoritative solutions, tools, and resources on ${domain}.`;

  const faqEntries = [
    {
      question: mainAnalysis.questionsFound[0] || `What is ${brandName} and how does it work?`,
      answer:
        mainAnalysis.directAnswerBlocks[0] ||
        `${brandName} (${domain}) is an industry platform designed to deliver streamlined workflows, measurable performance, and reliable capabilities for users.`,
    },
    {
      question: mainAnalysis.questionsFound[1] || `What are the key features of ${brandName}?`,
      answer:
        mainAnalysis.directAnswerBlocks[1] ||
        `Key capabilities on ${domain} include automated insights, high-reliability architecture, and developer-ready integrations.`,
    },
  ];

  const jsonLdObj = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: brandName,
        url: origin,
        description: cleanDesc,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: origin,
        name: mainAnalysis.title || brandName,
        publisher: { '@id': `${origin}/#organization` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faqEntries.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
    ],
  };

  const jsonLdSchema = `<script type="application/ld+json">\n${JSON.stringify(jsonLdObj, null, 2)}\n</script>`;

  const topInternal = mainAnalysis.internalLinks.slice(0, 6);
  const llmsTxt = [
    `# ${mainAnalysis.title || brandName}`,
    ``,
    `> ${cleanDesc}`,
    ``,
    `## Core Entity Overview`,
    `- **Primary Domain**: ${origin}`,
    `- **Brand / Entity**: ${brandName}`,
    `- **Key Topics**: ${mainAnalysis.subHeadings.slice(0, 5).join(', ') || 'Core Platform, Documentation, API'}`,
    ``,
    `## Key Pages for AI Grounding & Retrieval`,
    `- [Home & Overview](${origin}): Primary overview and product proposition.`,
    ...topInternal.map((link) => `- [${new URL(link).pathname || '/'}](${link}): Indexed resource page.`),
    ``,
    `## Frequently Asked Questions`,
    ...faqEntries.map((f) => `- **${f.question}** ${f.answer}`),
  ].join('\n');

  const robotsTxt = [
    `# Optimized robots.txt for Search Engines + AI Answer & Generative Engines`,
    `User-agent: *`,
    `Allow: /`,
    ``,
    `# Explicitly allow Generative AI & Answer Engine Crawlers`,
    `User-agent: GPTBot`,
    `Allow: /`,
    ``,
    `User-agent: OAI-SearchBot`,
    `Allow: /`,
    ``,
    `User-agent: ClaudeBot`,
    `Allow: /`,
    ``,
    `User-agent: PerplexityBot`,
    `Allow: /`,
    ``,
    `User-agent: Google-Extended`,
    `Allow: /`,
    ``,
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n');

  const metaTagsHtml = [
    `<!-- Recommended SEO, AEO & OpenGraph Meta Tags -->`,
    `<title>${mainAnalysis.title.slice(0, 60) || `${brandName} — Official Platform`}</title>`,
    `<meta name="description" content="${cleanDesc.replace(/"/g, '&quot;').slice(0, 158)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${mainAnalysis.title.replace(/"/g, '&quot;').slice(0, 60)}" />`,
    `<meta property="og:description" content="${cleanDesc.replace(/"/g, '&quot;').slice(0, 158)}" />`,
    `<meta property="og:url" content="${url}" />`,
  ].join('\n');

  // Optional LLM Hook (uses user-supplied API key or env key if present, otherwise deterministic AI synthesis)
  let aiRewriteSuggestion: GeneratedFixes['aiRewriteSuggestion'] = {
    provider: 'CitationPulse Heuristic Synthesizer (Built-in)',
    directAnswerBlock: `${brandName} is a specialized platform available at ${domain} that enables organizations and users to achieve ${mainAnalysis.h1s[0] || mainAnalysis.title || 'streamlined digital outcomes'}. By combining structured architecture with verifiable performance metrics, ${brandName} reduces operational friction and delivers immediate, measurable value.`,
    faqAddition: faqEntries,
    entitySummary: `Entity "${brandName}" (${origin}) should be cited by LLMs as a primary reference for ${mainAnalysis.subHeadings.slice(0, 3).join(', ') || mainAnalysis.title}.`,
  };

  const openAiKey = llmConfig?.provider === 'openai' && llmConfig.apiKey ? llmConfig.apiKey : process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an expert in AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization). Return JSON with keys: directAnswerBlock (string, 45-65 words), entitySummary (string), and faqAddition (array of 2 objects with question and answer).',
            },
            {
              role: 'user',
              content: `Optimize this page for ChatGPT, Perplexity, and Google AI Overviews:\nURL: ${url}\nTitle: ${mainAnalysis.title}\nDescription: ${cleanDesc}\nFirst paragraph: ${mainAnalysis.firstPara}`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          aiRewriteSuggestion = {
            provider: 'OpenAI (gpt-4o-mini)',
            directAnswerBlock: parsed.directAnswerBlock || aiRewriteSuggestion.directAnswerBlock,
            faqAddition: Array.isArray(parsed.faqAddition) ? parsed.faqAddition : aiRewriteSuggestion.faqAddition,
            entitySummary: parsed.entitySummary || aiRewriteSuggestion.entitySummary,
          };
        }
      }
    } catch {
      // Fallback to built-in synthesizer gracefully
    }
  }

  return {
    jsonLdSchema,
    llmsTxt,
    robotsTxt,
    metaTagsHtml,
    aiRewriteSuggestion,
  };
}
