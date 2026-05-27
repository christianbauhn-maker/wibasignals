/* =====================================================
   WIBA SIGNALS — App JS
   Loads articles from data/articles.json and renders
   the feed (index.html) and article view (article.html)
   ===================================================== */

'use strict';

// ─── State ──────────────────────────────────────────────
let ALL_ARTICLES = [];
let activeCategory = 'All';

// ─── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setDateDisplay();
  const isArticlePage = !!document.getElementById('js-content');
  if (!isArticlePage) {
    await initFeed();
  }
  // article.html init is handled inline in that file's <script>
});

// ─── Date display ────────────────────────────────────────
function setDateDisplay() {
  const el = document.getElementById('js-date');
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ─── Fetch Articles ──────────────────────────────────────
async function fetchArticles() {
  const res = await fetch('data/articles.json');
  if (!res.ok) throw new Error('Failed to load articles');
  const data = await res.json();
  return data.articles || [];
}

// ─── Feed (index.html) ───────────────────────────────────
async function initFeed() {
  try {
    ALL_ARTICLES = await fetchArticles();
    // Sort newest first
    ALL_ARTICLES.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderHero(ALL_ARTICLES);
    renderGrid(ALL_ARTICLES);
    initNavFilter();
    initFooterFilters();

    // Check for ?cat= param on load
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');
    if (cat) applyFilter(cat);

  } catch (e) {
    console.error(e);
    renderError();
  }
}

// ─── Hero ─────────────────────────────────────────────────
function renderHero(articles) {
  const featured = articles.find(a => a.featured) || articles[0];
  const sidebar  = articles.filter(a => a.slug !== featured.slug).slice(0, 4);

  // Main hero — skip re-render if pre-rendered content already matches featured article
  // This preserves the server-side pre-rendered LCP element and avoids a flash
  const main = document.getElementById('js-hero-main');
  if (main && main.dataset.prerendered !== featured.slug) {
    main.dataset.prerendered = featured.slug;
    main.innerHTML = `
      <span class="hero__category">${escHtml(featured.category)}</span>
      <h2 class="hero__headline"><a href="article.html?slug=${featured.slug}" onclick="goArticle('${featured.slug}'); return false;" style="color:inherit;text-decoration:none;">${escHtml(featured.title)}</a></h2>
      <p class="hero__deck">${escHtml(featured.summary)}</p>
      <div class="hero__meta">
        <span>${escHtml(featured.dateDisplay)}</span>
        <span class="hero__meta-sep">·</span>
        <span>${featured.readingTime} min read</span>
        <span class="hero__meta-sep">·</span>
        <span>Source: ${escHtml(featured.source)}</span>
        <span class="hero__meta-sep">·</span>
        <a class="hero__read-link" href="article.html?slug=${featured.slug}" onclick="goArticle('${featured.slug}'); return false;" aria-label="Read: ${escHtml(featured.title)}">Read →</a>
      </div>
    `;
  }

  // Sidebar
  const sidebarEl = document.getElementById('js-hero-sidebar');
  if (sidebarEl) {
    sidebarEl.innerHTML = sidebar.map(a => `
      <li class="hero__sidebar-item" onclick="goArticle('${a.slug}')">
        <p class="hero__sidebar-cat">${escHtml(a.category)}</p>
        <p class="hero__sidebar-head">${escHtml(a.title)}</p>
        <p class="hero__sidebar-date">${escHtml(a.dateDisplay)}</p>
      </li>
    `).join('');
  }
}

// ─── Grid ─────────────────────────────────────────────────
function renderGrid(articles) {
  const grid = document.getElementById('js-grid');
  const count = document.getElementById('js-feed-count');
  if (!grid) return;

  // Grid shows non-featured articles (or all if filtering)
  const featured = activeCategory === 'All'
    ? articles.find(a => a.featured)
    : null;
  const gridArticles = featured
    ? articles.filter(a => a.slug !== featured.slug)
    : articles;

  if (count) {
    count.textContent = gridArticles.length > 0
      ? `${gridArticles.length} article${gridArticles.length !== 1 ? 's' : ''}`
      : '';
  }

  if (gridArticles.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No articles in this category yet.</p></div>`;
    return;
  }

  grid.innerHTML = gridArticles.map(a => `
    <a class="card" href="article.html?slug=${a.slug}">
      <p class="card__category">${escHtml(a.category)}</p>
      ${a.series ? `<p class="card__series">${escHtml(a.series)} &nbsp;·&nbsp; Part ${a.seriesPart}</p>` : ''}
      <h3 class="card__headline">${escHtml(a.title)}</h3>
      <p class="card__summary">${escHtml(a.summary)}</p>
      <div class="card__footer">
        <span class="byline-pill"><span class="byline-pill__mark">W</span>Wiba Signals</span>
        <span class="card__meta">${escHtml(a.dateDisplay)} &nbsp;&middot;&nbsp; Lvl ${a.sourceLevel}</span>
      </div>
    </a>
  `).join('');
}

// ─── Navigation Filter ────────────────────────────────────
function initNavFilter() {
  const navItems = document.querySelectorAll('.nav-bar__item[data-cat]');
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      applyFilter(btn.dataset.cat);
    });
  });
}

function applyFilter(cat) {
  activeCategory = cat;

  // Update nav
  document.querySelectorAll('.nav-bar__item[data-cat]').forEach(btn => {
    const isActive = btn.dataset.cat === cat;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  // Update feed title
  const titleEl = document.getElementById('js-feed-title');
  if (titleEl) titleEl.textContent = cat === 'All' ? 'Latest' : cat;

  // Filter articles
  const filtered = cat === 'All'
    ? ALL_ARTICLES
    : ALL_ARTICLES.filter(a => a.category === cat);

  // Re-render hero only for "All"
  if (cat === 'All') {
    renderHero(ALL_ARTICLES);
    document.getElementById('js-hero').style.display = '';
  } else {
    document.getElementById('js-hero').style.display = 'none';
  }

  renderGrid(filtered);
}

function initFooterFilters() {
  document.querySelectorAll('[data-filter]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      applyFilter(link.dataset.filter);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ─── Navigation ───────────────────────────────────────────
function goArticle(slug) {
  window.location.href = `article.html?slug=${slug}`;
}

// ─── Article Page ─────────────────────────────────────────
async function loadArticle(slug) {
  try {
    const articles = await fetchArticles();
    const article = articles.find(a => a.slug === slug);

    if (!article) { showError(); return; }

    // Update page meta
    document.title = `${article.title} — Wiba Signals`;
    setMeta('js-page-desc', article.summary);
    setMeta('js-og-title', article.title);
    setMeta('js-og-desc', article.summary);

    // Canonical + OG:url
    const canonicalUrl = `https://wibasignals.com/article.html?slug=${encodeURIComponent(slug)}`;
    const canonicalEl = document.getElementById('js-canonical');
    if (canonicalEl) canonicalEl.setAttribute('href', canonicalUrl);
    setMeta('js-og-url', canonicalUrl);

    // Twitter Card
    setMeta('js-tw-title', article.title);
    setMeta('js-tw-desc', article.summary);

    // JSON-LD Article schema
    const jsonldEl = document.getElementById('js-jsonld');
    if (jsonldEl) {
      jsonldEl.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': article.title,
        'description': article.summary,
        'url': canonicalUrl,
        'datePublished': article.date,
        'author': {
          '@type': 'Person',
          'name': 'Christian Wiba',
          'url': 'https://www.linkedin.com/in/christianwiba'
        },
        'publisher': {
          '@type': 'Organization',
          '@id': 'https://wibasignals.com/#organization',
          'name': 'Wiba Signals',
          'url': 'https://wibasignals.com'
        },
        'keywords': article.tags ? article.tags.join(', ') : '',
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': canonicalUrl
        }
      });
    }

    // Update nav category label
    const navCat = document.getElementById('js-nav-category');
    if (navCat) navCat.textContent = article.category;

    // Render content
    document.getElementById('js-category').textContent = article.category;

    // Series label
    const seriesEl = document.getElementById('js-series');
    if (seriesEl) {
      if (article.series) {
        seriesEl.textContent = `${article.series} · Part ${article.seriesPart}`;
        seriesEl.style.display = '';
      } else {
        seriesEl.style.display = 'none';
      }
    }

    document.getElementById('js-headline').textContent = article.title;
    document.getElementById('js-deck').textContent = article.summary;
    document.getElementById('js-date-display').textContent = article.dateDisplay;
    document.getElementById('js-reading-time').textContent = article.readingTime;

    // Source badge
    const badge = document.getElementById('js-source-badge');
    if (badge) badge.innerHTML = `📚 ${escHtml(article.source)}`;

    // Body (trusted HTML from our own JSON)
    document.getElementById('js-body').innerHTML = article.body;

    // Source row
    const sourceRow = document.getElementById('js-source-row');
    if (sourceRow) {
      sourceRow.innerHTML = `
        <strong>Source:</strong> ${escHtml(article.source)} — Level ${article.sourceLevel} source
        ${article.sourceUrl ? ` · <a href="${article.sourceUrl}" target="_blank" rel="noopener">View source →</a>` : ''}
      `;
    }

    // Tags
    const tagsEl = document.getElementById('js-tags');
    if (tagsEl && article.tags) {
      tagsEl.innerHTML = article.tags.map(t =>
        `<span class="card__tag">${escHtml(t)}</span>`
      ).join('');
    }

    // Show content, hide skeleton
    document.getElementById('js-skeleton').style.display = 'none';
    document.getElementById('js-content').style.display = '';

  } catch (e) {
    console.error(e);
    showError();
  }
}

function showError() {
  const skel = document.getElementById('js-skeleton');
  const err  = document.getElementById('js-error');
  if (skel) skel.style.display = 'none';
  if (err)  err.style.display  = '';
}

function renderError() {
  const grid = document.getElementById('js-grid');
  if (grid) grid.innerHTML = `<div class="empty-state"><p>Unable to load articles. Please try again.</p></div>`;
}

// ─── Utils ────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function setMeta(id, content) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('content', content);
}
