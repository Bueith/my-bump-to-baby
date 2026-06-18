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
    const best = results.length > 0 ? results[0] : null;
    const rest = results.slice(1);

    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    return res.status(200).json({ query, best, results: rest });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error.", detail: String(err) });
  }
}

