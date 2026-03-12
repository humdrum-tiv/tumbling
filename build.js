#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { marked } = require('marked');
const config = require('./config');

// ── Configuration ────────────────────────────────────────────────────────────

const ARENA_TOKEN = process.env.ARENA_TOKEN;
const ARENA_BASE = 'https://api.are.na/v3';
const DOCS_DIR = path.join(__dirname, 'docs');
const SRC_DIR = path.join(__dirname, 'src');
const FONTS_DIR = path.join(__dirname, 'fonts');

if (!ARENA_TOKEN) {
  console.error('Error: ARENA_TOKEN environment variable is required.');
  console.error('Usage: ARENA_TOKEN=your_token node build.js');
  process.exit(1);
}

// Configure marked for safe rendering
marked.setOptions({ gfm: true, breaks: true });

// ── Are.na API helpers ───────────────────────────────────────────────────────

async function arenaFetch(path) {
  const url = `${ARENA_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${ARENA_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Are.na API error: ${res.status} ${res.statusText} — ${url}`);
  }
  return res.json();
}

// sortOrder: 'created_at_desc' for blog (newest first), 'position_asc' for pages
async function fetchAllBlocks(slug, sortOrder) {
  const blocks = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const data = await arenaFetch(
      `/channels/${slug}/contents?per=${perPage}&page=${page}&sort=${sortOrder}`
    );
    const contents = data.data || [];
    blocks.push(...contents);
    if (!data.meta || !data.meta.has_more_pages) break;
    page++;
  }
  return blocks;
}

// ── Date formatting ──────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function rssDate(iso) {
  if (!iso) return '';
  return new Date(iso).toUTCString();
}

// ── HTML utilities ────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return '';
  }
}

// ── Block renderers ──────────────────────────────────────────────────────────
// Each renderer returns { preview, expand, summary } HTML strings and { title, text }

function renderImage(block) {
  const img = block.image || {};
  const displayUrl = (img.display && img.display.url) || (img.original && img.original.url) || '';
  const originalUrl = (img.original && img.original.url) || displayUrl;
  const alt = esc(block.title || block.description || 'Image');
  const caption = block.description ? `<p class="entry-caption">${esc(block.description)}</p>` : '';
  const descExpand = block.description
    ? `<p class="expand-description">${esc(block.description)}</p>`
    : '';

  const preview = displayUrl
    ? `<div class="entry-image-wrap">
        <img class="entry-image-preview" src="${esc(displayUrl)}" alt="${alt}" loading="lazy">
      </div>${caption}`
    : `<div class="entry-inner"><p style="color:var(--gray-3);font-size:0.85rem;">[Image unavailable]</p></div>`;

  const expand = `<img class="expand-image-full" src="${esc(originalUrl)}" alt="${alt}" loading="lazy">${descExpand}`;

  return {
    preview,
    expand,
    summary: block.title || block.description || 'Image',
    hasExpand: originalUrl !== displayUrl || !!block.description,
  };
}

function renderText(block) {
  const raw = block.content || block.description || '';
  const titleHtml = block.title
    ? `<div class="entry-title">${esc(block.title)}</div>`
    : '';
  const contentHtml = raw ? marked(raw) : '';

  // Determine if we should show a "more" hint (content over ~300 plain chars)
  const plainLen = raw.replace(/<[^>]+>/g, '').length;
  const needsExpand = plainLen > 280;

  const previewClass = needsExpand ? 'entry-text-preview is-clipped' : 'entry-text-preview';
  const preview = `<div class="entry-inner">
    ${titleHtml}
    <div class="${previewClass}">${contentHtml}</div>
  </div>`;

  const expand = `<div class="expand-text-full">${contentHtml}</div>`;

  return {
    preview,
    expand,
    summary: block.title || raw.slice(0, 120),
    hasExpand: needsExpand,
  };
}

function renderLink(block) {
  const source = block.source || {};
  const url = source.url || block.source_url || '';
  const title = block.title || source.title || source.url || url;
  const description = block.description || source.description || '';
  const provider = source.provider_name || source.provider || domainOf(url);
  const favicon = faviconUrl(url);

  const faviconHtml = favicon
    ? `<img class="link-favicon" src="${esc(favicon)}" alt="" loading="lazy" aria-hidden="true">`
    : `<span class="link-favicon-fallback" aria-hidden="true">↗</span>`;

  const descHtml = description
    ? `<div class="link-description">${esc(description)}</div>`
    : '';

  const preview = `<div class="entry-inner">
    <div class="link-card">
      ${faviconHtml}
      <div class="link-body">
        <div class="link-title"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></div>
        <div class="link-domain">${esc(provider)}</div>
        ${descHtml}
      </div>
    </div>
  </div>`;

  const expandDescription = description
    ? `<div class="expand-link-desc">${esc(description)}</div>`
    : '';
  const expand = `<div class="expand-link-detail">
    <div class="expand-link-title"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></div>
    <div class="expand-link-url"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></div>
    ${expandDescription}
  </div>`;

  return {
    preview,
    expand,
    summary: title,
    hasExpand: !!description,
  };
}

function renderEmbed(block) {
  const embed = block.embed || {};
  const embedHtml = embed.html || '';
  const title = block.title || embed.title || 'Embedded media';
  const description = block.description || embed.description || '';

  const preview = `<div class="entry-inner">
    ${embedHtml ? `<div class="embed-preview">${embedHtml}</div>` : `<p style="color:var(--gray-3);font-size:0.85rem;">${esc(title)}</p>`}
  </div>`;

  const descExpand = description
    ? `<div class="expand-description">${esc(description)}</div>`
    : '';
  const expand = `<div class="expand-embed">${embedHtml}${descExpand}</div>`;

  return {
    preview,
    expand,
    summary: title,
    hasExpand: !!description,
  };
}

function renderAttachment(block) {
  const att = block.attachment || {};
  const url = att.url || '';
  const filename = att.file_name || block.title || 'Download';
  const ext = filename.split('.').pop().toUpperCase().slice(0, 6);
  const description = block.description || '';

  const preview = `<div class="entry-inner">
    <div class="attachment-row">
      <span class="attachment-icon">${esc(ext)}</span>
      <div class="attachment-filename">
        ${url
          ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(filename)}</a>`
          : esc(filename)}
      </div>
    </div>
  </div>`;

  const descExpand = description
    ? `<div class="expand-description">${esc(description)}</div>`
    : '';
  const expand = `<div>
    ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="font-weight:600;">${esc(filename)}</a>` : esc(filename)}
    ${descExpand}
  </div>`;

  return {
    preview,
    expand,
    summary: filename,
    hasExpand: !!description,
  };
}

function renderBlock(block) {
  const type = block.class_name || 'Text';
  switch (type) {
    case 'Image':      return renderImage(block);
    case 'Text':       return renderText(block);
    case 'Link':       return renderLink(block);
    case 'Embed':      return renderEmbed(block);
    case 'Attachment': return renderAttachment(block);
    default:           return renderText(block);
  }
}

// ── Entry HTML ───────────────────────────────────────────────────────────────

function blockTypeLabel(className) {
  const labels = {
    Image: 'Image',
    Text: 'Text',
    Link: 'Link',
    Embed: 'Media',
    Attachment: 'File',
    Channel: 'Channel',
  };
  return labels[className] || className;
}

function entryHtml(block) {
  const type = block.class_name || 'Text';
  const typeClass = `entry--${type.toLowerCase()}`;
  const date = formatDate(block.created_at);
  const dateLong = formatDateLong(block.created_at);
  const typeBadge = `<span class="entry-type">${esc(blockTypeLabel(type))}</span>`;

  const rendered = renderBlock(block);

  const metaRow = `<div class="entry-meta">${typeBadge}<span>${esc(date)}</span></div>`;
  const bodyHtml = metaRow + rendered.preview;

  const moreHint = rendered.hasExpand
    ? `<div class="entry-inner" style="padding-top:0;"><div class="entry-more-hint">Expand</div></div>`
    : '';

  const expandAttr = rendered.hasExpand
    ? ` data-expand="${esc(rendered.expand)}" data-date="${esc(dateLong)}"`
    : '';

  return `<article class="entry ${typeClass}"${expandAttr} data-id="${block.id}">
  ${bodyHtml}
  ${moreHint}
</article>`;
}

// ── Page block HTML ──────────────────────────────────────────────────────────

function pageBlockHtml(block) {
  const type = block.class_name || 'Text';
  const typeClass = `entry--${type.toLowerCase()}`;
  const date = formatDate(block.created_at);
  const dateLong = formatDateLong(block.created_at);
  const rendered = renderBlock(block);

  const expandAttr = rendered.hasExpand
    ? ` data-expand="${esc(rendered.expand)}" data-date="${esc(dateLong)}"`
    : '';

  const moreHint = rendered.hasExpand
    ? `<div class="entry-more-hint">Expand</div>`
    : '';

  return `<div class="page-block ${typeClass}"${expandAttr} data-id="${block.id}">
  ${rendered.preview}
  ${moreHint}
</div>`;
}

// ── HTML shell ────────────────────────────────────────────────────────────────

function navLinksHtml(activePage) {
  const links = [
    `<a href="index.html"${!activePage ? ' class="is-active"' : ''}>Feed</a>`,
    ...config.pages.map(p => {
      const slug = p.slug;
      const isActive = activePage === slug;
      return `<a href="pages/${slug}.html"${isActive ? ' class="is-active"' : ''}>${esc(p.name)}</a>`;
    }),
  ];
  return links.join('\n    ');
}

function htmlShell({ title, bodyContent, activePage, canonical }) {
  const pageTitle = title
    ? `${title} — ${config.siteTitle}`
    : config.siteTitle;

  const canonicalUrl = canonical || config.siteUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(config.siteDescription)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="${esc(config.siteTitle)}" href="${esc(config.siteUrl)}/rss.xml">
  <link rel="stylesheet" href="${activePage ? '../' : ''}styles.css">
</head>
<body>

<header class="site-header">
  <a class="site-title" href="${activePage ? '../' : ''}index.html">${esc(config.siteTitle)}</a>
  <nav class="site-nav">
    ${navLinksHtml(activePage)}
  </nav>
</header>

<main class="site-main">
${bodyContent}
</main>

<footer class="site-footer">
  <a class="footer-rss" href="${activePage ? '../' : ''}rss.xml">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="2.5" cy="9.5" r="1.5" fill="currentColor"/>
      <path d="M1 5.5A5.5 5.5 0 0 1 6.5 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M1 2A9 9 0 0 1 10 11" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>
    RSS Feed
  </a>
  <a class="footer-arena" href="https://www.are.na" target="_blank" rel="noopener noreferrer">Powered by Are.na</a>
</footer>

<script src="${activePage ? '../' : ''}client.js"></script>
</body>
</html>`;
}

// ── RSS feed ─────────────────────────────────────────────────────────────────

function blockRssItem(block) {
  const type = block.class_name || 'Text';
  const rendered = renderBlock(block);
  const title = block.title || blockTypeLabel(type);
  const link = `${config.siteUrl}/index.html#block-${block.id}`;
  const pubDate = rssDate(block.created_at);
  const guid = `https://api.are.na/v3/blocks/${block.id}`;

  const description = rendered.summary || '';
  const fullDesc = rendered.expand || rendered.preview || '';

  return `    <item>
      <title>${escXml(title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="false">${escXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${fullDesc}]]></description>
    </item>`;
}

function buildRss(blocks) {
  const items = blocks.slice(0, 50).map(blockRssItem).join('\n');
  const lastBuild = new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(config.siteTitle)}</title>
    <link>${escXml(config.siteUrl)}</link>
    <description>${escXml(config.siteDescription)}</description>
    <atom:link href="${escXml(config.siteUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

// ── File helpers ──────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  } else {
    console.warn(`Warning: ${src} not found, skipping copy.`);
  }
}

function linkOrCopyFonts() {
  const destFonts = path.join(DOCS_DIR, 'fonts');
  if (!fs.existsSync(FONTS_DIR)) {
    console.warn('Warning: fonts/ directory not found. Add font files to /fonts/ for typography to work.');
    ensureDir(destFonts);
    return;
  }
  // Copy font files into docs/fonts/
  ensureDir(destFonts);
  const files = fs.readdirSync(FONTS_DIR);
  files.forEach(f => {
    const src = path.join(FONTS_DIR, f);
    const dest = path.join(destFonts, f);
    if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
      fs.copyFileSync(src, dest);
    }
  });
}

// ── Main build ────────────────────────────────────────────────────────────────

async function build() {
  console.log('Building Tumbling...');
  ensureDir(DOCS_DIR);
  ensureDir(path.join(DOCS_DIR, 'pages'));

  // Copy static assets
  copyFile(path.join(SRC_DIR, 'styles.css'), path.join(DOCS_DIR, 'styles.css'));
  copyFile(path.join(SRC_DIR, 'client.js'), path.join(DOCS_DIR, 'client.js'));
  linkOrCopyFonts();

  // Fetch blog blocks — newest first via API sort
  console.log(`Fetching blog channel: ${config.blogChannel}`);
  let blogBlocks = [];
  try {
    blogBlocks = await fetchAllBlocks(config.blogChannel, 'created_at_desc');
  } catch (err) {
    console.error('Failed to fetch blog channel:', err.message);
    process.exit(1);
  }
  console.log(`  ${blogBlocks.length} blocks fetched`);

  // Build blog index
  let feedHtml;
  if (blogBlocks.length === 0) {
    feedHtml = `<div class="state-empty"><p>No posts yet.</p></div>`;
  } else {
    feedHtml = blogBlocks.map(entryHtml).join('\n');
  }

  const indexHtml = htmlShell({
    title: null,
    bodyContent: feedHtml,
    activePage: null,
    canonical: config.siteUrl,
  });
  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), indexHtml, 'utf-8');
  console.log('  Wrote docs/index.html');

  // Build RSS
  const rssXml = buildRss(blogBlocks);
  fs.writeFileSync(path.join(DOCS_DIR, 'rss.xml'), rssXml, 'utf-8');
  console.log('  Wrote docs/rss.xml');

  // Build additional pages
  for (const page of config.pages) {
    console.log(`Fetching page channel: ${page.slug} (${page.name})`);
    let pageBlocks = [];
    try {
      pageBlocks = await fetchAllBlocks(page.slug, 'position_asc');
    } catch (err) {
      console.error(`  Failed to fetch page channel ${page.slug}:`, err.message);
      continue;
    }
    // Pages keep manual position order (owner's arrangement in Are.na)
    console.log(`  ${pageBlocks.length} blocks fetched`);

    let pageBodyHtml;
    if (pageBlocks.length === 0) {
      pageBodyHtml = `<div class="state-empty"><p>No content yet.</p></div>`;
    } else {
      pageBodyHtml = `<div class="page-header">
  <div class="page-title">${esc(page.name)}</div>
</div>
<div class="page-grid">
${pageBlocks.map(pageBlockHtml).join('\n')}
</div>`;
    }

    const pageHtml = htmlShell({
      title: page.name,
      bodyContent: pageBodyHtml,
      activePage: page.slug,
      canonical: `${config.siteUrl}/pages/${page.slug}.html`,
    });
    fs.writeFileSync(
      path.join(DOCS_DIR, 'pages', `${page.slug}.html`),
      pageHtml,
      'utf-8'
    );
    console.log(`  Wrote docs/pages/${page.slug}.html`);
  }

  console.log('\nBuild complete!');
  console.log(`Output: ${DOCS_DIR}`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
