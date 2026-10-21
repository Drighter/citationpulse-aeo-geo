import http from 'node:http';
import assert from 'node:assert';
import { app } from './index.js';

// Spin up a local mock target website so the test suite is 100% deterministic and fast
function createMockTargetServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`User-agent: *\nAllow: /\nUser-agent: GPTBot\nAllow: /\nSitemap: http://127.0.0.1/sitemap.xml`);
        return;
      }
      if (req.url === '/llms.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`# Acme AI Cloud\n> Enterprise AI infrastructure for developers.\n## Core Docs\n- /docs`);
        return;
      }
      if (req.url === '/sitemap.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>http://127.0.0.1/</loc></url></urlset>`);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Acme AI Cloud — Enterprise GPU & RAG Infrastructure Platform</title>
        <meta name="description" content="Acme AI Cloud is an enterprise GPU and RAG platform that helps engineering teams deploy low-latency AI workloads 3.5x faster with 99.99% uptime." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="http://127.0.0.1/" />
        <meta property="og:title" content="Acme AI Cloud" />
        <meta property="og:image" content="http://127.0.0.1/og.png" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
              "@type": "Question",
              "name": "How does Acme AI Cloud optimize RAG latency?",
              "acceptedAnswer": { "@type": "Answer", "text": "By co-locating vector indexes with H100 GPUs." }
            }]
          }
        </script>
      </head>
      <body>
        <main>
          <article>
            <h1>Enterprise GPU & RAG Infrastructure Platform</h1>
            <p>Acme AI Cloud is a platform that provides distributed inference and vector retrieval for production engineering teams, cutting p99 latency by 42% and saving $120k annually.</p>
            <h2>How does Acme AI Cloud reduce inference latency?</h2>
            <p>Acme AI Cloud reduces inference latency by combining quantized KV-cache routing with zero-copy InfiniBand networking across 8x H100 clusters, delivering 18ms time-to-first-token across global regions.</p>
            <h2>What are the pricing tiers for Acme AI Cloud?</h2>
            <p>Acme AI Cloud offers pay-as-you-go serverless endpoints starting at $0.85 per million tokens as well as dedicated reserved clusters with 99.99% SLA guarantees and SOC2 Type II compliance.</p>
            <ul>
              <li>99.99% Uptime SLA across 12 availability zones</li>
              <li>Sub-20ms vector retrieval on 100M+ embeddings</li>
            </ul>
            <img src="/diagram.png" alt="Architecture diagram" />
            <a href="https://openai.com">OpenAI Reference</a>
            <a href="https://arxiv.org/abs/2311.09735">GEO Research Paper</a>
            <a href="https://schema.org">Schema.org Spec</a>
          </article>
        </main>
      </body>
      </html>`);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

async function runTests() {
  process.env.NODE_ENV = 'test';
  const mockSite = await createMockTargetServer();
  const apiServer = http.createServer(app);

  await new Promise<void>((r) => apiServer.listen(0, '127.0.0.1', () => r()));
  const apiPort = (apiServer.address() as { port: number }).port;
  const apiBase = `http://127.0.0.1:${apiPort}`;

  try {
    console.log('1. Testing Healthcheck...');
    const healthRes = await fetch(`${apiBase}/api/health`);
    assert.strictEqual(healthRes.status, 200);

    console.log('2. Testing Demo Account Login...');
    const loginRes = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@citationpulse.io', password: 'demo1234' }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = (await loginRes.json()) as { token: string };
    assert.ok(loginData.token);

    console.log('3. Testing Dashboard SEO/AEO/GEO Scan & Fix Generation...');
    const scanRes = await fetch(`${apiBase}/api/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({ url: mockSite.url, maxPages: 1 }),
    });
    assert.strictEqual(scanRes.status, 201);
    const scanReport = (await scanRes.json()) as {
      scores: { overall: number; seo: number; aeo: number; geo: number };
      generatedFixes: { jsonLdSchema: string; llmsTxt: string; robotsTxt: string };
    };
    console.log('   -> Computed Scores:', scanReport.scores);
    assert.ok(scanReport.scores.overall >= 75, 'Expected high score on well-optimized mock page');
    assert.ok(scanReport.generatedFixes.jsonLdSchema.includes('application/ld+json'));
    assert.ok(scanReport.generatedFixes.llmsTxt.includes('Key Pages for AI Grounding'));

    console.log('4. Testing Developer API Key Generation & Public /api/v1/scan Endpoint...');
    const createKeyRes = await fetch(`${apiBase}/api/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({ name: 'Automated Test Suite Key' }),
    });
    assert.strictEqual(createKeyRes.status, 201);
    const keyData = (await createKeyRes.json()) as { id: string; rawKey: string };
    assert.ok(keyData.rawKey.startsWith('ag_live_'));

    const v1ScanRes = await fetch(`${apiBase}/api/v1/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': keyData.rawKey,
      },
      body: JSON.stringify({ url: mockSite.url }),
    });
    assert.strictEqual(v1ScanRes.status, 200);
    assert.ok(v1ScanRes.headers.get('x-ratelimit-remaining'));
    const v1Data = (await v1ScanRes.json()) as { object: string; scores: { overall: number } };
    assert.strictEqual(v1Data.object, 'scan_report');

    console.log('5. Testing Stripe / Tier Subscription Upgrade Flow...');
    const upgradeRes = await fetch(`${apiBase}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({ plan: 'enterprise', mode: 'instant' }),
    });
    assert.strictEqual(upgradeRes.status, 200);

    console.log('6. Testing Muse Connector & Lead Offer Creation Flow...');
    const museSyncRes = await fetch(`${apiBase}/api/muse/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({
        businessName: 'Acme AI Cloud',
        siteUrl: mockSite.url,
        industry: 'Cloud Infrastructure',
        keyServices: ['GPU Clusters', 'RAG Vector Engine'],
      }),
    });
    assert.strictEqual(museSyncRes.status, 200);

    const offerRes = await fetch(`${apiBase}/api/muse/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({
        title: 'Free GPU Credit Offer',
        headline: 'Get $500 in Free H100 GPU Credits',
        description: 'Sign up today to receive $500 in inference credits.',
        offerType: 'discount',
        promoCode: 'MUSEGPU500',
        ctaText: 'Claim $500 Credits',
        ctaUrl: `${mockSite.url}/claim`,
      }),
    });
    assert.strictEqual(offerRes.status, 201);

    const v1OffersRes = await fetch(`${apiBase}/api/v1/muse/offers`, {
      headers: { 'X-API-Key': keyData.rawKey },
    });
    assert.strictEqual(v1OffersRes.status, 200);

    console.log('\n✅ ALL E2E TESTS PASSED!');
  } finally {
    await mockSite.close();
    await new Promise<void>((r) => apiServer.close(() => r()));
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
