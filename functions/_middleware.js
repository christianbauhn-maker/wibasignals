/**
 * Cloudflare Pages Function - OG tag middleware
 *
 * Intercepts requests to /article.html?slug=<id>, fetches the matching
 * article from /data/articles.json, and injects article-specific Open Graph
 * + Twitter Card meta tags before serving the page.
 *
 * Social crawlers (Bluesky, LinkedIn, X, Slack) do NOT execute JavaScript,
 * so all OG tags must be present in the raw HTML this function returns.
 */

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Pass through everything that is not article.html
  if (url.pathname !== '/article.html') {
    return next();
  }

  const slug = url.searchParams.get('slug');
  if (!slug) return next();

  // Fetch the static HTML response and the articles data in parallel
  const [response, articlesResp] = await Promise.all([
    next(),
    fetch(new URL('/data/articles.json', url.origin)),
  ]);

  if (!articlesResp.ok) return response;

  let article;
  try {
    const articles = await articlesResp.json();
    const list = Array.isArray(articles) ? articles : (articles.articles || []);
    article = list.find((a) => a.id === slug);
  } catch {
    return response;
  }

  // Unknown slug - serve the unmodified page (JS will handle the 404 state)
  if (!article) return response;

  const ogImage = `https://wibasignals.com/assets/og/${slug}.jpg`;
  const ogUrl   = `https://wibasignals.com/article.html?slug=${slug}`;
  const title   = escapeAttr(article.title   || 'Wiba Signals');
  const desc    = escapeAttr(article.summary || '');

  const appendedTags = [
    `<meta property="og:image"        content="${ogImage}">`,
    `<meta property="og:image:width"  content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:image"       content="${ogImage}">`,
    `<meta name="twitter:title"       content="${title}">`,
    `<meta name="twitter:description" content="${desc}">`,
  ].join('\n  ');

  return new HTMLRewriter()
    // Page title
    .on('title', {
      element(el) {
        el.setInnerContent(`${article.title || 'Wiba Signals'} - Wiba Signals`);
      },
    })
    // Rewrite existing OG / Twitter meta tags
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', title); },
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', desc); },
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', ogUrl); },
    })
    .on('meta[name="twitter:card"]', {
      element(el) { el.setAttribute('content', 'summary_large_image'); },
    })
    // Append image tags (og:image doesn't exist yet in article.html)
    .on('head', {
      element(el) {
        el.append(`\n  ${appendedTags}\n`, { html: true });
      },
    })
    .transform(response);
}
