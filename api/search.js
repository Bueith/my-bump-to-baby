// /api/search.js
//
// Vercel Serverless Function — proxies search queries to Serper.dev,
// a Google Search API wrapper that requires no billing setup.
// Results are filtered to trusted pregnancy/medical domains and ranked
// by source authority + relevance before being returned to the client.
//
// For the highlighted "best" result, this also fetches the real
// article page and uses Mozilla's Readability library (the engine
// behind Firefox's Reader Mode) to reliably identify the actual
// article body — not navigation, ads, or "related articles" widgets —
// then picks the most relevant paragraph from within that real body.
//
// Required environment variable (set in Vercel project settings
// and in .env.local for local testing with vercel dev):
//   SERPER_API_KEY  - your API key from https://serper.dev

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = (req.query.q || "").toString().trim();
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'." });
  }
  if (query.length > 200) {
    return res.status(400).json({ error: "Query is too long." });
  }

  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Search is not configured yet. Set SERPER_API_KEY in your Vercel project's environment variables."
    });
  }

  // Two authority tiers used to rank results.
  // Tier 1: medically reviewed clinical authorities (weighted highest).
  // Tier 2: trusted pregnancy/parenting community and editorial sites.
  const TIER_1_CLINICAL = ["nhs.uk", "acog.org"];
  const TIER_2_COMMUNITY = [
    "mayoclinic.org",
    "kidshealth.org",
    "babycenter.com",
    "whattoexpect.com",
    "peanut-app.io"
  ];
  const TRUSTED_DOMAINS = [...TIER_1_CLINICAL, ...TIER_2_COMMUNITY];

  function matchedDomain(urlString) {
    try {
      const host = new URL(urlString).hostname.replace(/^www\./, "");
      return TRUSTED_DOMAINS.find(
        (domain) => host === domain || host.endsWith("." + domain)
      ) || null;
    } catch {
      return null;
    }
  }

  function authorityScore(domain) {
    if (TIER_1_CLINICAL.includes(domain)) return 2;
    if (TIER_2_COMMUNITY.includes(domain)) return 1;
    return 0;
  }

  function relevanceScore(item, query) {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    if (words.length === 0) return 0;
    const haystack = `${item.title || ""} ${item.snippet || ""}`.toLowerCase();
    const matches = words.filter((w) => haystack.includes(w)).length;
    return matches / words.length;
  }

  /**
   * Fetches the actual article page and uses Readability (the same
   * content-extraction engine behind Firefox's Reader Mode) to isolate
   * the real article body — reliably excluding navigation menus,
   * "related articles" widgets, and ads, which a hand-rolled regex
   * approach cannot reliably distinguish from real content.
   *
   * Within that clean article body, we then score paragraphs by query
   * relevance and return the single best-matching one — so the result
   * is the part of the article that actually answers the question,
   * not just the introduction.
   *
   * Always has a safe fallback: if the fetch fails, times out, or
   * Readability can't parse the page, the caller just keeps using the
   * short search snippet instead — this never breaks the response.
   */
  async function extractRelevantExcerpt(url, query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const pageResponse = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NurtureBot/1.0; +https://nurture.app)"
        }
      });
      clearTimeout(timeout);

      if (!pageResponse.ok) return null;

      const html = await pageResponse.text();

      // Parse the HTML into a real DOM (linkedom), then hand it to
      // Readability exactly the way a browser's Reader Mode would.
      const { document } = parseHTML(html);
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article || !article.textContent) return null;

      // Readability gives us clean article text with paragraph breaks
      // preserved. Split into paragraphs and discard fragments that
      // are too short to be real sentences (stray captions, bylines).
      const paragraphs = article.textContent
        .split(/\n+/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length >= 60);

      if (paragraphs.length === 0) return null;

      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);

      // Score every real paragraph by how many distinct query words it
      // contains, take the single highest-scoring one. Ties favor the
      // earlier paragraph (usually more foundational to the topic).
      let bestParagraph = null;
      let bestScore = -1;

      paragraphs.forEach((p, index) => {
        const lower = p.toLowerCase();
        const matchCount = queryWords.filter((w) => lower.includes(w)).length;
        const score = matchCount - index * 0.01;
        if (matchCount > 0 && score > bestScore) {
          bestScore = score;
          bestParagraph = p;
        }
      });

      // If nothing in the article actually matches the query words,
      // fall back to the article's own opening paragraph rather than
      // returning nothing — still real article content, just not
      // targeted to a specific phrase.
      if (!bestParagraph) {
        bestParagraph = paragraphs[0];
      }

      if (bestParagraph.length > 600) {
        bestParagraph = bestParagraph.slice(0, 600).replace(/\s+\S*$/, "") + "…";
      }

      return bestParagraph;
    } catch (err) {
      clearTimeout(timeout);
      return null;
    }
  }

  try {
    // Serper.dev endpoint — returns Google search results via a simple
    // REST API with no billing setup required.
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: `${query} pregnancy OR postpartum OR baby OR newborn`,
        num: 10,
        safe: "active"
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: "Search provider error.", detail });
    }

    const data = await response.json();

    // Serper returns results in data.organic
    const items = Array.isArray(data.organic) ? data.organic : [];

    const scored = items
      .map((item) => {
        const domain = matchedDomain(item.link);
        if (!domain) return null;
        const authority = authorityScore(domain);
        const relevance = relevanceScore(item, query);
        const combined = authority * 2 + relevance * 3;
        return {
          title: item.title || "",
          snippet: item.snippet || "",
          link: item.link || "",
          source: domain,
          tier: authority === 2 ? "clinical" : "community",
          _score: combined
        };
      })
      .filter(Boolean)
      .sort((a, b) => b._score - a._score);

    const results = scored.slice(0, 4).map(({ _score, ...rest }) => rest);
    let best = results.length > 0 ? results[0] : null;
    const rest = results.slice(1);

    // For the highlighted "best answer" only, try to pull a real,
    // relevant excerpt directly from the article — this is what
    // replaces the thin/generic search snippet with an actual answer.
    // If anything goes wrong, `best` just keeps its original snippet.
    if (best) {
      const excerpt = await extractRelevantExcerpt(best.link, query);
      if (excerpt) {
        best = { ...best, snippet: excerpt, excerptSource: "article" };
      } else {
        best = { ...best, excerptSource: "snippet" };
      }
    }

    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.status(200).json({ query, best, results: rest });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error.", detail: String(err) });
  }
}

