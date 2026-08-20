var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var escapeAttr = /* @__PURE__ */ __name((str) => String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), "escapeAttr");

var worker_default = {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (pathname === "/worker-ping") {
        return new Response(JSON.stringify({ worker: true, v: 5 }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      if (pathname === "/data/articles.json") {
        const index = await env.ARTICLES_KV.get("articles_index");
        if (index) {
          return new Response(index, {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }
          });
        }
        return env.ASSETS.fetch(request);
      }

      if (pathname !== "/article.html" && pathname !== "/article") {
        return env.ASSETS.fetch(request);
      }

      const slug = url.searchParams.get("slug");
      if (!slug) return env.ASSETS.fetch(request);

      const article = await env.ARTICLES_KV.get(`article:${slug}`, { type: "json" });
      if (!article) return env.ASSETS.fetch(request);

      const origin = new URL(request.url).origin;
      const assetReq = new Request(`${origin}/article`, { method: "GET" });
      const response = await env.ASSETS.fetch(assetReq);

      const debugInfo = `slug:${slug};assets:${response.status};ok:${response.ok}`;
      const ogImage = `https://wibasignals.com/assets/og/${slug}.jpg`;
      const ogUrl = `https://wibasignals.com/article.html?slug=${slug}`;
      const title = escapeAttr(article.title || "Wiba Signals");
      const desc = escapeAttr(article.summary || "");

      const appendedTags = [
        `<meta property="og:image"        content="${ogImage}">`,
        `<meta property="og:image:width"  content="1200">`,
        `<meta property="og:image:height" content="630">`,
        `<meta name="twitter:image"       content="${ogImage}">`,
        `<meta name="twitter:title"       content="${title}">`,
        `<meta name="twitter:description" content="${desc}">`
      ].join("\n  ");

      const transformed = new HTMLRewriter()
        .on("title", { element(el) { el.setInnerContent(`${article.title} -- Wiba Signals`); } })
        .on('meta[property="og:title"]', { element(el) { el.setAttribute("content", title); } })
        .on('meta[property="og:description"]', { element(el) { el.setAttribute("content", desc); } })
        .on('meta[property="og:url"]', { element(el) { el.setAttribute("content", ogUrl); } })
        .on('meta[name="twitter:card"]', { element(el) { el.setAttribute("content", "summary_large_image"); } })
        .on("head", { element(el) { el.append(`\n  ${appendedTags}\n`, { html: true }); } })
        .transform(response);

      const newHeaders = new Headers(transformed.headers);
      newHeaders.set("x-wiba-debug", debugInfo);
      newHeaders.set("Cache-Control", "no-store");
      return new Response(transformed.body, { status: transformed.status, headers: newHeaders });

    } catch (e) {
      const errResp = await env.ASSETS.fetch(request);
      const h = new Headers(errResp.headers);
      h.set("x-wiba-error", String(e));
      h.set("Cache-Control", "no-store");
      return new Response(errResp.body, { status: errResp.status, headers: h });
    }
  }
};

export { worker_default as default };