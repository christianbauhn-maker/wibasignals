/**
 * _worker.js -- Cloudflare Workers Assets entry point
 * Injects article-specific OG tags server-side for /article.html?slug=X
 * Social crawlers don't run JS, so tags must be in the raw HTML response.
 *
 * Article metadata is embedded directly to avoid env.ASSETS recursive fetch issues.
 * Update ARTICLES map whenever a new article is published.
 */

const escapeAttr = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const ARTICLES = {
  'the-first-domino': {
    title: 'The First Domino',
    summary: "Yesterday, Micron fell 7%. The Philadelphia Semiconductor Index dropped more than 5%. Financial media named the cause: earnings revisions, AI spend skepticism. Those explanations are not wrong. They are downstream. The signal started two floors below semiconductors. It started with diesel — and at 10:30 AM Eastern today, the EIA will print the number that defines how much runway is left.",
  },
  'ai-economy-two-layers': {
    title: 'The AI Economy Has Two Layers. The Market Counts One.',
    summary: "Nvidia's quarterly Data Center revenue crossed $75 billion. Annualized AI service consumption across Anthropic, OpenAI, and Microsoft Copilot totals roughly $60 to $75 billion. Infrastructure spend is running at approximately ten times the consumption layer. Both are real numbers. They measure different things.",
  },
  'ai-measurement-problem': {
    title: 'The Number Everyone Cites Is Wrong',
    summary: 'The most widely cited AI adoption figure -- 88% of companies -- comes from surveys restricted to organisations with $500 million or more in annual revenue. Eurostat shows 11% of small enterprises used AI in 2024, versus 41% of large ones.',
  },
  'ai-roi-reckoning': {
    title: 'AI Budgets Face a Reckoning: 71% of CIOs Must Show ROI in 6 Months',
    summary: '71% of chief information officers must demonstrate AI ROI within 6 months or face budget cuts. 90% of 6,000 surveyed CEOs report no measurable impact on employment or productivity. Over $1 trillion has been invested in AI since 2022.',
  },
  'china-ai-layoffs-illegal': {
    title: "China's Courts Drew a Line: AI Is Not Grounds for Dismissal",
    summary: 'Chinese courts have ruled in two separate cases that companies cannot dismiss workers simply because AI can now perform their role. Across the Pacific, 78,000-92,000 US tech workers were laid off in the same period, nearly half attributed to AI.',
  },
  'chinese-ai-models-silicon-valley': {
    title: '80% of Silicon Valley Open-Source AI Runs on Chinese Models',
    summary: 'Qwen, DeepSeek, Kimi and other Chinese AI models now account for the majority of open-source AI adoption among Silicon Valley startups. The decision is primarily about cost and capability, not geopolitics.',
  },
  'data-center-power-grid': {
    title: '49,000 Residents Lose Grid Priority to Data Centers',
    summary: 'A Nevada utility will cut 75% of electricity supply to 49,000 Lake Tahoe residents by May 2027 -- redirecting capacity to data centers serving Google, Apple, and Microsoft.',
  },
  'eu-ai-act-august-2026': {
    title: 'EU AI Act: The August 2026 Deadline Companies Are Missing',
    summary: "The EU AI Act's high-risk obligations take effect in August 2026. Companies using AI in hiring, credit scoring, or other high-risk categories face fines of up to 15 million EUR or 3% of global turnover. The Act applies to any company serving EU customers.",
  },
  'friedman-ai-governance': {
    title: 'Friedman: AI Governance Needs a Nixon-China Moment',
    summary: 'Tom Friedman argues that AI governance requires US-China cooperation comparable in geopolitical significance to the Nixon-Mao opening -- and that adversarial competition without governance frameworks risks outcomes neither side can control.',
  },
  'gartner-ai-layoffs-zero-gain': {
    title: 'Gartner: AI-Related Layoffs Produced Zero Financial Gain',
    summary: 'Gartner studied 350 companies with revenues above $1 billion and found that those cutting staff while adopting AI saw zero financial gain compared to those that retained their workforce. The companies reporting highest AI ROI were not the ones reducing headcount.',
  },
  'graduate-unemployment-ai': {
    title: '42% of Recent US Graduates Are Underemployed -- The Highest Rate Since 2020',
    summary: '42% of recent US college graduates are underemployed -- the highest rate since 2020. CS graduate hiring has fallen sharply. Dario Amodei projects that AI will automate 50% of entry-level white-collar jobs within several years.',
  },
  'keep-em-waiting-part-1': {
    title: 'The Silence That Was Louder Than Any Tariff',
    summary: 'On April 9, 2025, the bond market taught every US trading partner the same lesson -- there is a price at which Trump folds. The thirteen months of European silence that followed were not weakness but a calculated bet that American courts and markets would do enforcement work for free.',
  },
  'meta-bossware-surveillance': {
    title: 'When Surveillance Becomes the Product: Meta and the Bossware Shift',
    summary: 'Meta employees are protesting keystroke tracking and AI surveillance software, days before a planned 10% headcount reduction. A Gartner study finds that companies cutting staff after AI adoption saw zero financial gain versus those who retained their workforce.',
  },
  'oracle-workers-training-replacements': {
    title: 'Trained Out: Oracle Workers Who Documented Their Own Replacement',
    summary: 'Oracle employees were asked to document their specific workflows in detail -- data that was then used to train the AI systems that replaced them. A survey of 200 former Oracle employees found patterns suggesting the layoffs disproportionately affected older workers.',
  },
  'productivity-paradox-measurement': {
    title: 'The Productivity Paradox Is Real. But It Is a Measurement Problem.',
    summary: '90% of companies report no measurable productivity improvement from AI. The NBER researchers who produced that figure argue the measurement instrument -- sales per employee -- may not capture where AI value actually lands.',
  },
  'sweden-distribution-problem': {
    title: "The Country With the World's Best AI Talent Density Can't Distribute the Knowledge",
    summary: 'Sweden produces more AI researchers per capita than almost any country on earth. The knowledge does not reach Swedish SMEs. The gap between production and distribution is a structural problem, not a communications failure.',
  },
  'swedish-sme-chatbot-trap': {
    title: 'Most SMEs Tried AI. They Tried the Wrong Thing.',
    summary: 'A majority of Swedish SMEs have experimented with generative AI tools. Most chose the wrong implementation approach -- deploying chatbots in contexts where they could not deliver measurable value.',
  },
  'career-ladder-bottom-rung': {
    title: "AI Isn't Taking the Jobs. It's Removing the Rungs.",
    summary: 'Entry-level white-collar employment is contracting. The jobs at the bottom of the professional ladder -- the ones that historically taught people how to do the jobs above them -- are disappearing faster than the mid-level roles they were supposed to prepare people for.',
  },
  'ai-can-read-its-own-thoughts': {
    title: 'AI Can Now Read Its Own Thoughts -- And It Reveals a Blind Spot',
    summary: 'Researchers have developed techniques that allow AI systems to monitor their own internal processing. The findings reveal that models do not always reason in the way their outputs suggest -- a gap with implications for AI reliability and interpretability.',
  },
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Debug ping -- remove after confirming Worker runs
      if (pathname === '/worker-ping') {
        return new Response(JSON.stringify({ worker: true, v: 4 }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Intercept both /article.html and /article
      // Cloudflare Assets redirects /article.html -> /article (clean URLs),
      // so crawlers may hit either. We handle both here.
      if (pathname !== '/article.html' && pathname !== '/article') {
        return env.ASSETS.fetch(request);
      }

      const slug = url.searchParams.get('slug');
      if (!slug) return env.ASSETS.fetch(request);

      const article = ARTICLES[slug];
      if (!article) return env.ASSETS.fetch(request);

      // Fetch article.html from ASSETS using a clean Request (no query string)
      const origin = new URL(request.url).origin;
      const assetReq = new Request(`${origin}/article`, { method: 'GET' });
      const response = await env.ASSETS.fetch(assetReq);

      // Debug header -- remove after confirming OG injection works
      const debugInfo = `slug:${slug};assets:${response.status};ok:${response.ok}`;

      const ogImage = `https://wibasignals.com/assets/og/${slug}.jpg`;
      const ogUrl   = `https://wibasignals.com/article.html?slug=${slug}`;
      const title   = escapeAttr(article.title || 'Wiba Signals');
      const desc    = escapeAttr(article.summary || '');

      const appendedTags = [
        `<meta property="og:image"        content="${ogImage}">`,
        `<meta property="og:image:width"  content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta name="twitter:image"       content="${ogImage}">`,
        `<meta name="twitter:title"       content="${title}">`,
        `<meta name="twitter:description" content="${desc}">`,
      ].join('\n  ');

      const transformed = new HTMLRewriter()
        .on('title', {
          element(el) { el.setInnerContent(`${article.title} -- Wiba Signals`); },
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

      // Add debug + no-store so CF edge never caches article responses again
      const newHeaders = new Headers(transformed.headers);
      newHeaders.set('x-wiba-debug', debugInfo);
      newHeaders.set('Cache-Control', 'no-store');
      return new Response(transformed.body, { status: transformed.status, headers: newHeaders });

    } catch(e) {
      const errResp = await env.ASSETS.fetch(request);
      const h = new Headers(errResp.headers);
      h.set('x-wiba-error', String(e));
      h.set('Cache-Control', 'no-store');
      return new Response(errResp.body, { status: errResp.status, headers: h });
    }
  },
};
