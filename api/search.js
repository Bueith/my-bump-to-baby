// /api/search.js
//
// Vercel Serverless Function — proxies search queries to Serper.dev,
// a Google Search API wrapper that requires no billing setup.
// Results are filtered to trusted pregnancy/medical domains and ranked
// by source authority + relevance before being returned to the client.
//
// Required environment variable (set in Vercel project settings
// and in .env.local for local testing with vercel dev):
//   SERPER_API_KEY  - your API key from https://serper.dev

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
   * Fetches the actual article page and extracts the paragraph(s) that
   * best match the query — not just the first paragraph, and not the
   * generic search-snippet teaser. This is what fixes the "the link
   * dumped me at the top of an unrelated section" problem: we read the
   * real page server-side and find the part that actually answers the
   * question, then show that directly on the card.
   *
   * Always has a safe fallback: if the fetch fails, times out, or the
   * page can't be parsed, the caller just keeps using the short search
   * snippet instead — this never breaks the response.
   */
  async function extractRelevantExcerpt(url, query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const pageResponse = await fetch(url, {
        signal: controller.signal,
        headers: {
          // A normal browser-like user agent — some sites block requests
          // that look like bots/scrapers with no user agent at all.
          "User-Agent": "Mozilla/5.0 (compatible; NurtureBot/1.0; +https://nurture.app)"
        }
      });
      clearTimeout(timeout);

      if (!pageResponse.ok) return null;

      const html = await pageResponse.text();

      // Strip script/style/nav/header/footer blocks entirely before
      // converting to text, so junk (menus, ads, cookie banners) never
      // makes it into the candidate paragraphs.
      const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ");

      // Pull out <p> tag contents specifically — articles are reliably
      // structured this way across all of our trusted domains, and it
      // avoids pulling in stray text from buttons, captions, etc.
      const paragraphMatches = [...cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];

      const paragraphs = paragraphMatches
        .map((m) =>
          m[1]
            .replace(/<[^>]+>/g, " ")   // strip any nested tags
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter((p) => p.length >= 60);  // skip short fragments/captions

      if (paragraphs.length === 0) return null;

      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);

      // Score every paragraph by how many distinct query words it
      // contains, then take the single highest-scoring one. Ties are
      // broken by preferring the earlier paragraph (usually more
      // foundational / introductory to the topic).
      let bestParagraph = null;
      let bestScore = -1;

      paragraphs.forEach((p, index) => {
        const lower = p.toLowerCase();
        const matchCount = queryWords.filter((w) => lower.includes(w)).length;
        // Small positional bonus for earlier paragraphs so a tie goes
        // to the more likely "intro" paragraph rather than a random
        // later one that happens to repeat the same words.
        const score = matchCount - index * 0.01;
        if (matchCount > 0 && score > bestScore) {
          bestScore = score;
          bestParagraph = p;
        }
      });

      if (!bestParagraph) return null;

      // Cap length so the card stays readable — a real excerpt, not a
      // wall of text, but several real sentences rather than one line.
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

