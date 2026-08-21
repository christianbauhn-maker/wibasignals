var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var escapeAttr = __name((str) => String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), "escapeAttr");
const ADMIN_TOKEN = "wiba-kv-admin-2026-b7r3p9";
var worker_default = {
async fetch(request, env) {
try {
const url = new URL(request.url);
const pathname = url.pathname;
if (pathname === "/worker-ping") {
return new Response(JSON.stringify({ worker: true, v: 7 }), {
headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
});
}
if (pathname === "/admin/kv/seed" && request.method === "POST") {
const token = request.headers.get("X-Admin-Token");
if (token !== ADMIN_TOKEN) return new Response("Unauthorized", { status: 401 });
const body = await request.json();
const articles = body.articles || [];
await env.ARTICLES_KV.put("articles_index", JSON.stringify(body.index || body));
for (const a of articles) {
const slug = a.slug || a.id;
if (slug) await env.ARTICLES_KV.put("article:" + slug, JSON.stringify({ title: a.title || "", summary: a.summary || a.excerpt || "" }));
}
return new Response(JSON.stringify({ ok: true, seeded: articles.length }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
if (pathname === "/admin/kv/publish" && request.method === "POST") {
const token = request.headers.get("X-Admin-Token");
if (token !== ADMIN_TOKEN) return new Response("Unauthorized", { status: 401 });
const body = await request.json();
const article = body.article;
const index = body.index;
if (!article || !index) return new Response("Missing article or index", { status: 400 });
const slug = article.slug || article.id;
await env.ARTICLES_KV.put("article:" + slug, JSON.stringify({ title: article.title || "", summary: article.summary || article.excerpt || "" }));
await env.ARTICLES_KV.put("articles_index", JSON.stringify(index));
return new Response(JSON.stringify({ ok: true, slug }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
if (pathname === "/data/articles.json") {
const index = await env.ARTICLES_KV.get("articles_index");
if (index) return new Response(index, { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
return env.ASSETS.fetch(request);
}
if (pathname !== "/article.html" && pathname !== "/article") return env.ASSETS.fetch(request);
const slug = url.searchParams.get("slug");
// FIX v7: soft 404 -> 301 redirect to homepage when no slug provided
if (!slug) return Response.redirect("https://wibasignals.com/", 301);
const article = await env.ARTICLES_KV.get("article:" + slug, { type: "json" });
// FIX v7: unknown slug -> 301 redirect to homepage instead of empty 200
if (!article) return Response.redirect("https://wibasignals.com/", 301);
const origin = new URL(request.url).origin;
const assetReq = new Request(origin + "/article", { method: "GET" });
const response = await env.ASSETS.fetch(assetReq);
const ogImage = "https://wibasignals.com/assets/og/" + slug + ".jpg";
const ogUrl = "https://wibasignals.com/article.html?slug=" + slug;
const title = escapeAttr(article.title || "Wiba Signals");
const desc = escapeAttr(article.summary || "");
const appendedTags = '<meta property="og:image" content="' + ogImage + '">\n <meta property="og:image:width" content="1200">\n <meta property="og:image:height" content="630">\n <meta name="twitter:image" content="' + ogImage + '">\n <meta name="twitter:title" content="' + title + '">\n <meta name="twitter:description" content="' + desc + '">';
const transformed = new HTMLRewriter()
.on("title", { element(el) { el.setInnerContent(article.title + " -- Wiba Signals"); } })
.on('meta[property="og:title"]', { element(el) { el.setAttribute("content", title); } })
.on('meta[property="og:description"]', { element(el) { el.setAttribute("content", desc); } })
.on('meta[property="og:url"]', { element(el) { el.setAttribute("content", ogUrl); } })
.on('meta[name="twitter:card"]', { element(el) { el.setAttribute("content", "summary_large_image"); } })
.on('link[rel="canonical"]', { element(el) { el.setAttribute("href", ogUrl); } })
.on("head", { element(el) { el.append("\n " + appendedTags + "\n", { html: true }); } })
.transform(response);
const newHeaders = new Headers(transformed.headers);
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