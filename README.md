# CitationPulse — SEO, AEO & GEO Optimization SaaS & Developer API

A full-stack SaaS platform and developer REST API that audits websites across three critical visibility pillars:
1. **SEO (Search Engine Optimization)**: Title tags, meta descriptions, H1 hierarchy, canonical tags, OpenGraph metadata, image alt coverage, and XML sitemaps.
2. **AEO (Answer Engine Optimization)**: JSON-LD structured schema (`Organization`, `WebSite`, `FAQPage`, `HowTo`), conversational question headings (`What/How/Why`), 40–75 word direct-answer snippet blocks, structured lists/tables, and Flesch syntactic readability.
3. **GEO (Generative Engine Optimization)**: `/llms.txt` machine context discovery, AI crawler permissions in `/robots.txt` (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`), quantitative fact/statistic density, authoritative external citations, and brand entity clarity.

---

## Quick Start

From the project root (`c:\Users\danri\Documents\AEOGEOTool`):

```bash
# Start both the Express Backend API (port 4000) and React Vite Frontend (port 5173)
npm run dev
```

- **Web Dashboard**: `http://localhost:5173`
- **Backend REST API**: `http://localhost:4000`
- **Pre-seeded Demo Pro Account**: `demo@citationpulse.io` / `demo1234`
- **Pre-seeded Demo Developer API Key**: `ag_live_demo_secret_key_2026`

---

## Developer API (`v1`)

Authenticate requests using the `X-API-Key` header or `Authorization: Bearer ag_live_...`. All keys are hashed with SHA-256 at rest and enforced with sliding-window rate limiters (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).

### `POST /api/v1/scan`

```bash
curl -X POST http://localhost:4000/api/v1/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ag_live_demo_secret_key_2026" \
  -d '{
    "url": "https://stripe.com",
    "maxPages": 2
  }'
```

### `GET /api/v1/scans`
Returns recent scan summaries for your workspace.

### `GET /api/v1/scans/:id`
Returns the full diagnostic report and auto-generated code fixes (`jsonLdSchema`, `llmsTxt`, `robotsTxt`, `metaTagsHtml`, and `aiRewriteSuggestion`) for a specific scan.
