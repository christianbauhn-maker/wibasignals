/**
 * _worker.js — Cloudflare Pages Advanced Mode Worker
 * Injects article-specific OG tags server-side for /article.html?slug=X
 * Social crawlers don't run JS, so tags must be in the raw HTML response.
 */

const escapeAttr = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname !== '/article.html') {
        return env.ASSETS.fetch(request);
      }

      const slug = url.searchParams.get('slug');
      if (!slug) return env.ASSETS.fetch(request);

      const [response, articlesResp] = await Promise.all([
        env.ASSETS.fetch(request),
        env.ASSETS.fetch(new Request(new URL('/data/articles.json', url.origin))),
      ]);

      if (!articlesResp.ok) return response;

      let article;
      try {
        const data = await articlesResp.json();
        const list = Array.isArray(data) ? data : (data.articles || []);
        article = list.find((a) => a.id === slug);
      } catch {
        return response;
      }

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
        .on('title', {
          element(el) { el.setInnerContent(`${article.title || 'Wiba Signals'} — Wiba Signals`); },
        })
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
        .on('head', {
          element(el) { el.append(`\n  ${appendedTags}\n`, { html: true }); },
        })
        .transform(response);

    } catch {
      return env.ASSETS.fetch(request);
    }
  },
};
