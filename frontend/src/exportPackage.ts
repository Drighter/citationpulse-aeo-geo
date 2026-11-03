import type { ScanReport } from './types';

// ==================== 1. ZERO-DEPENDENCY PKZIP ARCHIVE BUILDER ====================
// Builds a standards-compliant .zip file (Store mode + CRC32) directly in the browser.
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntryFile {
  name: string;
  content: string;
}

export function createZipArchive(files: ZipEntryFile[]): Blob {
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + file name)
    const localHeader = new Uint8Array(30 + nameBytes.length + size);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true); // Local file header signature
    localView.setUint16(4, 20, true); // Version needed to extract (2.0)
    localView.setUint16(6, 0x0800, true); // UTF-8 filename flag
    localView.setUint16(8, 0, true); // Compression method (0 = Store)
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true); // Compressed size
    localView.setUint32(22, size, true); // Uncompressed size
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localHeaders.push(localHeader);

    // Central directory header (46 bytes + file name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); // Central file header signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0x0800, true); // UTF-8 filename flag
    centralView.setUint16(10, 0, true); // Compression method (0 = Store)
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // End of central dir signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, files.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, files.length, true); // Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, offset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  return new Blob([...localHeaders, ...centralHeaders, eocd], { type: 'application/zip' });
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeFilenameSlug(domain: string): string {
  return (domain || 'site')
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ==================== 2. MARKDOWN EXECUTIVE SUMMARY BUILDER ====================
export function generateMarkdownReport(report: ScanReport): string {
  const passCount = report.checks.filter((c) => c.status === 'pass').length;
  const warnCount = report.checks.filter((c) => c.status === 'warn').length;
  const failCount = report.checks.filter((c) => c.status === 'fail').length;

  const lines: string[] = [
    `# CitationPulse SEO, AEO & GEO Audit Package — ${report.domain}`,
    ``,
    `- **Target URL**: ${report.url}`,
    `- **Scanned At**: ${new Date(report.scannedAt).toLocaleString()}`,
    `- **Pages Crawled**: ${report.crawlPagesCount} (${report.metadata.wordCount} words analyzed in ${report.durationMs}ms)`,
    `- **Report ID**: \`${report.id}\``,
    ``,
    `## 1. Executive Score Summary`,
    ``,
    `| Pillar | Score | Status | Focus Area |`,
    `| :--- | :---: | :---: | :--- |`,
    `| **Overall Index** | **${report.scores.overall}/100** | ${report.scores.overall >= 80 ? '🟢 Strong' : report.scores.overall >= 60 ? '🟡 Needs Tuning' : '🔴 Action Required'} | Combined Search & AI Citation Readiness |`,
    `| **SEO Score** | **${report.scores.seo}/100** | ${report.scores.seo >= 80 ? '🟢 Strong' : report.scores.seo >= 60 ? '🟡 Needs Tuning' : '🔴 Action Required'} | Traditional Search Engine Crawl & Metadata |`,
    `| **AEO Score** | **${report.scores.aeo}/100** | ${report.scores.aeo >= 80 ? '🟢 Strong' : report.scores.aeo >= 60 ? '🟡 Needs Tuning' : '🔴 Action Required'} | Answer Engine & Featured Snippet Readiness |`,
    `| **GEO Score** | **${report.scores.geo}/100** | ${report.scores.geo >= 80 ? '🟢 Strong' : report.scores.geo >= 60 ? '🟡 Needs Tuning' : '🔴 Action Required'} | Generative AI Grounding (ChatGPT, Perplexity, Claude, Gemini) |`,
    ``,
    `**Diagnostics Breakdown**: ✅ ${passCount} Passed · ⚠️ ${warnCount} Warnings · ❌ ${failCount} Critical Fixes`,
    ``,
    `## 2. Generative AI Crawler & Discovery Matrix`,
    ``,
    `- \`/robots.txt\`: **${report.aiCrawlerAccess.hasRobotsTxt ? 'Found' : 'Missing'}**`,
    `- \`/llms.txt\`: **${report.aiCrawlerAccess.hasLlmsTxt ? 'Found' : 'Missing'}**`,
    `- \`/sitemap.xml\`: **${report.aiCrawlerAccess.hasSitemapXml ? 'Found' : 'Missing'}**`,
    ``,
    `| AI Bot | Engine / Company | Crawl Status |`,
    `| :--- | :--- | :--- |`,
    ...report.aiCrawlerAccess.bots.map(
      (b) => `| \`${b.bot}\` | ${b.company} | ${b.status === 'allowed' ? '✅ Allowed' : '❌ Blocked'} |`
    ),
    ``,
  ];

  if (report.generatedFixes.aiRewriteSuggestion) {
    lines.push(
      `## 3. AI-Synthesized Direct Answer & Entity Grounding`,
      ``,
      `### Recommended Opening Answer Block (40–65 words)`,
      `> ${report.generatedFixes.aiRewriteSuggestion.directAnswerBlock}`,
      ``,
      `### Knowledge Graph Entity Statement`,
      `> ${report.generatedFixes.aiRewriteSuggestion.entitySummary}`,
      ``
    );
  }

  lines.push(
    `## 4. Prioritized Diagnostic Checks`,
    ``,
    `| Category | Check | Status | Impact | Score | Detected | Recommendation |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
    ...report.checks.map(
      (c) =>
        `| **${c.category.toUpperCase()}** | ${c.title} | ${
          c.status === 'pass' ? '✅ PASS' : c.status === 'warn' ? '⚠️ WARN' : '❌ FAIL'
        } | ${c.impact.toUpperCase()} | ${c.score}/${c.maxScore} | \`${c.value.replace(/\|/g, '/')}\` | ${c.recommendation.replace(/\|/g, '/')} |`
    ),
    ``,
    `## 5. Included Implementation Fix Files (in this Package)`,
    ``,
    `1. \`fixes/schema-jsonld.html\` — Paste inside your \`<head>\` to expose verified \`Organization\`, \`WebSite\`, and \`FAQPage\` structured data.`,
    `2. \`fixes/llms.txt\` — Host at \`https://${report.domain}/llms.txt\` for ChatGPT, Claude, and Perplexity RAG grounding.`,
    `3. \`fixes/robots.txt\` — Host at \`https://${report.domain}/robots.txt\` to explicitly allow AI answer crawlers.`,
    `4. \`fixes/meta-tags.html\` — Optimized Title, Meta Description, Canonical, OpenGraph, and Twitter Card tags.`,
    `5. \`index.html\` — Open in any web browser for the interactive visual report or to Print / Save as PDF.`,
    `6. \`scan-report.json\` — Raw portable report data (can be imported into any CitationPulse workspace).`,
    ``
  );

  return lines.join('\n');
}

// ==================== 3. STANDALONE INTERACTIVE HTML REPORT BUILDER ====================
export function generateInteractiveHtmlReport(report: ScanReport): string {
  const scoreColor = (score: number) =>
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';

  const checksHtml = report.checks
    .map((c) => {
      const badgeColor =
        c.status === 'pass'
          ? 'background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);'
          : c.status === 'warn'
          ? 'background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);'
          : 'background:rgba(244,63,94,0.15);color:#fb7185;border:1px solid rgba(244,63,94,0.3);';
      return `
        <div class="check-card" data-category="${escapeHtml(c.category)}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:260px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                <span style="${badgeColor}padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">
                  ${escapeHtml(c.status)}
                </span>
                <span style="background:#1e293b;color:#cbd5e1;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;">
                  ${escapeHtml(c.category)}
                </span>
                <strong style="font-size:14px;color:#f8fafc;">${escapeHtml(c.title)}</strong>
                <span style="font-size:10px;text-transform:uppercase;padding:2px 7px;border-radius:5px;background:rgba(99,102,241,0.15);color:#a5b4fc;">
                  ${escapeHtml(c.impact)} impact
                </span>
              </div>
              <p style="margin:4px 0 6px;font-size:13px;color:#cbd5e1;line-height:1.5;">${escapeHtml(c.recommendation)}</p>
              <div style="font-family:ui-monospace,monospace;font-size:12px;color:#818cf8;">Detected: ${escapeHtml(c.value)}</div>
            </div>
            <div style="text-align:right;min-width:70px;">
              <span style="font-size:18px;font-weight:800;color:#ffffff;">${c.score}</span>
              <span style="font-size:12px;color:#64748b;"> / ${c.maxScore}</span>
            </div>
          </div>
        </div>`;
    })
    .join('\n');

  const botsHtml = report.aiCrawlerAccess.bots
    .map(
      (b) => `
      <div style="background:#020617;border:1px solid #1e293b;border-radius:12px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <code style="font-size:12px;font-weight:700;color:#f8fafc;">${escapeHtml(b.bot)}</code>
          <span style="font-size:11px;font-weight:700;color:${b.status === 'allowed' ? '#34d399' : '#fb7185'};text-transform:uppercase;">
            ${b.status === 'allowed' ? '✓ Allowed' : '✕ Blocked'}
          </span>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${escapeHtml(b.company)}</div>
      </div>`
    )
    .join('\n');

  const pagesHtml = report.pages
    .map(
      (p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;">
          <div style="font-weight:600;color:#f8fafc;">${escapeHtml(p.title)}</div>
          <div style="font-family:monospace;font-size:11px;color:#818cf8;">${escapeHtml(p.url)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;">${p.wordCount}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#34d399;font-weight:700;">${p.seoScore}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#a78bfa;font-weight:700;">${p.aeoScore}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#fbbf24;font-weight:700;">${p.geoScore}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;">${
          p.schemaTypes.length > 0 ? escapeHtml(p.schemaTypes.join(', ')) : 'None'
        }</td>
      </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CitationPulse Audit Report — ${escapeHtml(report.domain)} (${report.scores.overall}/100)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: #020617;
      color: #f8fafc;
      line-height: 1.5;
      padding: 32px 20px 64px;
    }
    .container { max-width: 1120px; margin: 0 auto; }
    .header-bar {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      border: 1px solid #312e81; border-radius: 18px; padding: 24px; margin-bottom: 24px;
    }
    .grid-4 {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;
    }
    .score-card {
      background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 20px;
    }
    .section-card {
      background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 22px; margin-bottom: 24px;
    }
    .check-card {
      background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 10px;
    }
    .code-box {
      background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #a5b4fc;
      overflow-x: auto; white-space: pre-wrap; word-break: break-word; max-height: 320px;
    }
    .btn {
      background: #4f46e5; color: #ffffff; border: none; padding: 9px 16px; border-radius: 10px;
      font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    }
    .btn:hover { background: #6366f1; }
    .btn-secondary {
      background: #1e293b; color: #e2e8f0; border: 1px solid #334155;
    }
    @media print {
      body { background: #ffffff; color: #0f172a; padding: 0; }
      .no-print { display: none !important; }
      .header-bar, .score-card, .section-card, .check-card {
        background: #ffffff !important; border-color: #cbd5e1 !important; color: #0f172a !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="background:#4f46e5;color:#fff;font-weight:800;font-size:11px;padding:3px 9px;border-radius:99px;letter-spacing:0.05em;text-transform:uppercase;">
            CitationPulse Shareable Audit Package
          </span>
          <span style="font-size:12px;color:#94a3b8;">Scanned ${escapeHtml(new Date(report.scannedAt).toLocaleString())}</span>
        </div>
        <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">${escapeHtml(report.metadata.title || report.domain)}</h1>
        <a href="${escapeHtml(report.url)}" target="_blank" rel="noreferrer" style="color:#818cf8;font-size:13px;text-decoration:none;">
          ${escapeHtml(report.url)} ↗
        </a>
        <p style="margin:8px 0 0;font-size:13px;color:#cbd5e1;max-width:740px;">
          ${escapeHtml(report.metadata.description || 'No meta description found on target page.')}
        </p>
      </div>
      <div class="no-print" style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <div style="font-size:11px;color:#94a3b8;">
          ${report.crawlPagesCount} page(s) • ${report.metadata.wordCount} words • ${report.durationMs}ms
        </div>
      </div>
    </div>

    <div class="grid-4">
      <div class="score-card">
        <div style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">Overall Index</div>
        <div style="font-size:36px;font-weight:900;color:${scoreColor(report.scores.overall)};margin:6px 0;">
          ${report.scores.overall}<span style="font-size:16px;color:#64748b;">/100</span>
        </div>
        <div style="font-size:12px;color:#cbd5e1;">Combined Search & AI Score</div>
      </div>
      <div class="score-card">
        <div style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">SEO Score</div>
        <div style="font-size:36px;font-weight:900;color:${scoreColor(report.scores.seo)};margin:6px 0;">
          ${report.scores.seo}<span style="font-size:16px;color:#64748b;">/100</span>
        </div>
        <div style="font-size:12px;color:#cbd5e1;">Traditional Search Ranking</div>
      </div>
      <div class="score-card">
        <div style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">AEO Score</div>
        <div style="font-size:36px;font-weight:900;color:${scoreColor(report.scores.aeo)};margin:6px 0;">
          ${report.scores.aeo}<span style="font-size:16px;color:#64748b;">/100</span>
        </div>
        <div style="font-size:12px;color:#cbd5e1;">Answer & Snippet Readiness</div>
      </div>
      <div class="score-card">
        <div style="font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;">GEO Score</div>
        <div style="font-size:36px;font-weight:900;color:${scoreColor(report.scores.geo)};margin:6px 0;">
          ${report.scores.geo}<span style="font-size:16px;color:#64748b;">/100</span>
        </div>
        <div style="font-size:12px;color:#cbd5e1;">LLM Citation & Grounding</div>
      </div>
    </div>

    <div class="section-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
        <h2 style="margin:0;font-size:16px;font-weight:700;">Generative AI Crawler & Machine Discovery Matrix</h2>
        <div style="display:flex;gap:8px;font-size:12px;">
          <span style="padding:3px 10px;border-radius:99px;background:#020617;border:1px solid #334155;">
            /robots.txt: <strong>${report.aiCrawlerAccess.hasRobotsTxt ? 'Found' : 'Missing'}</strong>
          </span>
          <span style="padding:3px 10px;border-radius:99px;background:#020617;border:1px solid #334155;">
            /llms.txt: <strong>${report.aiCrawlerAccess.hasLlmsTxt ? 'Found' : 'Missing'}</strong>
          </span>
          <span style="padding:3px 10px;border-radius:99px;background:#020617;border:1px solid #334155;">
            /sitemap.xml: <strong>${report.aiCrawlerAccess.hasSitemapXml ? 'Found' : 'Missing'}</strong>
          </span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
        ${botsHtml}
      </div>
    </div>

    ${
      report.generatedFixes.aiRewriteSuggestion
        ? `
    <div class="section-card" style="border-color:rgba(99,102,241,0.4);">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#a5b4fc;">
        ✨ AI-Synthesized Direct Answer Block & Entity Grounding (${escapeHtml(
          report.generatedFixes.aiRewriteSuggestion.provider
        )})
      </h2>
      <div style="background:#020617;border:1px solid #1e293b;border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:#818cf8;margin-bottom:4px;">
          Recommended Opening Answer Block (40–65 words for Featured Snippets & Perplexity/ChatGPT Citations):
        </div>
        <div style="font-size:14px;color:#f1f5f9;">${escapeHtml(
          report.generatedFixes.aiRewriteSuggestion.directAnswerBlock
        )}</div>
      </div>
      <div style="background:#020617;border:1px solid #1e293b;border-radius:12px;padding:14px;">
        <div style="font-size:12px;font-weight:700;color:#34d399;margin-bottom:4px;">
          LLM Knowledge Graph Entity Statement:
        </div>
        <div style="font-size:13px;color:#cbd5e1;">${escapeHtml(
          report.generatedFixes.aiRewriteSuggestion.entitySummary
        )}</div>
      </div>
    </div>`
        : ''
    }

    <div class="section-card">
      <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;">
        Diagnostic Audit Checks (${report.checks.length})
      </h2>
      ${checksHtml}
    </div>

    <div class="section-card">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;">
        Ready-to-Deploy Code Fixes (Included in Package)
      </h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:16px;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="font-size:13px;">1. JSON-LD Structured Schema (fixes/schema-jsonld.html)</strong>
            <button class="btn btn-secondary no-print" onclick="navigator.clipboard.writeText(document.getElementById('code-jsonld').innerText)">Copy</button>
          </div>
          <pre id="code-jsonld" class="code-box">${escapeHtml(report.generatedFixes.jsonLdSchema)}</pre>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="font-size:13px;">2. /llms.txt Machine Context File (fixes/llms.txt)</strong>
            <button class="btn btn-secondary no-print" onclick="navigator.clipboard.writeText(document.getElementById('code-llms').innerText)">Copy</button>
          </div>
          <pre id="code-llms" class="code-box">${escapeHtml(report.generatedFixes.llmsTxt)}</pre>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="font-size:13px;">3. AI-Ready /robots.txt (fixes/robots.txt)</strong>
            <button class="btn btn-secondary no-print" onclick="navigator.clipboard.writeText(document.getElementById('code-robots').innerText)">Copy</button>
          </div>
          <pre id="code-robots" class="code-box">${escapeHtml(report.generatedFixes.robotsTxt)}</pre>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="font-size:13px;">4. Optimized Meta & OpenGraph Tags (fixes/meta-tags.html)</strong>
            <button class="btn btn-secondary no-print" onclick="navigator.clipboard.writeText(document.getElementById('code-meta').innerText)">Copy</button>
          </div>
          <pre id="code-meta" class="code-box">${escapeHtml(report.generatedFixes.metaTagsHtml)}</pre>
        </div>
      </div>
    </div>

    <div class="section-card">
      <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;">Crawled Pages Breakdown (${report.pages.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid #334155;color:#94a3b8;font-size:11px;text-transform:uppercase;">
            <th style="padding:10px 12px;">Page URL & Title</th>
            <th style="padding:10px 12px;">Words</th>
            <th style="padding:10px 12px;">SEO</th>
            <th style="padding:10px 12px;">AEO</th>
            <th style="padding:10px 12px;">GEO</th>
            <th style="padding:10px 12px;">Detected Schemas</th>
          </tr>
        </thead>
        <tbody>
          ${pagesHtml}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

// ==================== 4. PACKAGE BUNDLER & BROWSER DOWNLOAD TRIGGERS ====================
export function buildAuditPackageFiles(report: ScanReport): ZipEntryFile[] {
  const readme = [
    `===================================================================`,
    `CITATIONPULSE — SHAREABLE SEO, AEO & GEO AUDIT PACKAGE`,
    `===================================================================`,
    `Target Domain : ${report.domain}`,
    `Target URL    : ${report.url}`,
    `Scanned At    : ${new Date(report.scannedAt).toLocaleString()}`,
    `Overall Score : ${report.scores.overall}/100 (SEO: ${report.scores.seo} | AEO: ${report.scores.aeo} | GEO: ${report.scores.geo})`,
    ``,
    `FILES INCLUDED IN THIS PACKAGE:`,
    `1. index.html              -> Double-click to open the interactive visual report in any browser (or Print to PDF).`,
    `2. AUDIT-REPORT.md         -> Executive summary & prioritized checklist in Markdown for Notion, GitHub, or Slack.`,
    `3. scan-report.json        -> Full machine-readable audit dataset (can be imported into any CitationPulse workspace).`,
    `4. fixes/schema-jsonld.html-> Ready-to-paste Schema.org JSON-LD script for your <head>.`,
    `5. fixes/llms.txt          -> Upload to https://${report.domain}/llms.txt for AI Answer Engine grounding.`,
    `6. fixes/robots.txt        -> Upload to https://${report.domain}/robots.txt to permit GPTBot, ClaudeBot & PerplexityBot.`,
    `7. fixes/meta-tags.html    -> Optimized Title, Meta Description, Canonical, and OpenGraph tags.`,
    `===================================================================`,
  ].join('\n');

  return [
    { name: 'index.html', content: generateInteractiveHtmlReport(report) },
    { name: 'AUDIT-REPORT.md', content: generateMarkdownReport(report) },
    { name: 'scan-report.json', content: JSON.stringify(report, null, 2) },
    { name: 'README.txt', content: readme },
    { name: 'fixes/schema-jsonld.html', content: report.generatedFixes.jsonLdSchema },
    { name: 'fixes/llms.txt', content: report.generatedFixes.llmsTxt },
    { name: 'fixes/robots.txt', content: report.generatedFixes.robotsTxt },
    { name: 'fixes/meta-tags.html', content: report.generatedFixes.metaTagsHtml },
  ];
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadAuditPackageZip(report: ScanReport): string {
  const slug = getSafeFilenameSlug(report.domain);
  const datePart = new Date(report.scannedAt || Date.now()).toISOString().slice(0, 10);
  const filename = `citationpulse-package-${slug}-${datePart}.zip`;
  const files = buildAuditPackageFiles(report);
  const zipBlob = createZipArchive(files);
  triggerBlobDownload(zipBlob, filename);
  return filename;
}

export function downloadStandaloneHtmlReport(report: ScanReport): string {
  const slug = getSafeFilenameSlug(report.domain);
  const datePart = new Date(report.scannedAt || Date.now()).toISOString().slice(0, 10);
  const filename = `citationpulse-report-${slug}-${datePart}.html`;
  const html = generateInteractiveHtmlReport(report);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, filename);
  return filename;
}

export function downloadMarkdownSummary(report: ScanReport): string {
  const slug = getSafeFilenameSlug(report.domain);
  const datePart = new Date(report.scannedAt || Date.now()).toISOString().slice(0, 10);
  const filename = `citationpulse-audit-${slug}-${datePart}.md`;
  const md = generateMarkdownReport(report);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerBlobDownload(blob, filename);
  return filename;
}

export function downloadJsonReport(report: ScanReport): string {
  const slug = getSafeFilenameSlug(report.domain);
  const datePart = new Date(report.scannedAt || Date.now()).toISOString().slice(0, 10);
  const filename = `citationpulse-scan-${slug}-${datePart}.json`;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerBlobDownload(blob, filename);
  return filename;
}
