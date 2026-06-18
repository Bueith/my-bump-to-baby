# Nurture — setup notes

## Running locally with Live Server (no search)

Open this folder in VS Code, right-click `index.html`, choose
"Open with Live Server." The marketing page and the full app
dashboard work, including all 18 built-in questions, localStorage
trackers, and the diary. The "Search trusted medical sources" button
will not work under Live Server — see below.

## Running locally with the trusted-source search working

Live Server only serves static files; it cannot run the serverless
function in `/api/search.js`. To test search locally:

1. Install the Vercel CLI: `npm install -g vercel`
2. From this folder, run: `vercel dev`
3. Open the local URL it gives you (usually `http://localhost:3000`)

`vercel dev` runs your static files AND the `/api/search` function
together, exactly like production.

## Setting up the search API key

The search feature uses Google's Custom Search JSON API, restricted
to a trusted-source allowlist. Results are also ranked server-side
into two tiers so the single best match is highlighted:

- **Tier 1 — medically reviewed clinical authorities** (ranked
  highest): `nhs.uk`, `acog.org`
- **Tier 2 — trusted pregnancy/parenting sources**: `mayoclinic.org`,
  `kidshealth.org`, `babycenter.com`, `whattoexpect.com`,
  `peanut-app.io`

Edit `TIER_1_CLINICAL` and `TIER_2_COMMUNITY` near the top of
`api/search.js` to change this list or the ranking weight.

1. Go to https://programmablesearchengine.google.com/ and create a
   new search engine. Under "Sites to search," add each domain
   above using the "Entire domain" pattern, e.g. `www.nhs.uk/*`,
   `www.acog.org/*`, `www.mayoclinic.org/*`, `kidshealth.org/*`,
   `www.babycenter.com/*`, `www.whattoexpect.com/*`,
   `www.peanut-app.io/*`. Copy the "Search engine ID" — this is your
   `GOOGLE_CSE_ID`.
2. Go to https://console.cloud.google.com/apis/credentials, enable
   the "Custom Search API," and create an API key. This is your
   `GOOGLE_CSE_API_KEY`.
3. Locally: create a file named `.env` in this folder containing:
   ```
   GOOGLE_CSE_API_KEY=your_key_here
   GOOGLE_CSE_ID=your_search_engine_id_here
   ```
   `vercel dev` reads this automatically. Never commit this file.
4. On Vercel: in your project's Settings → Environment Variables,
   add the same two variables, then redeploy.

The free tier of the Custom Search API allows 100 queries per day.
Beyond that it returns billing-required errors, which the front end
will show as a "search failed" message rather than crashing.

## Deploying to Vercel

Push this folder to a GitHub repo and import it in Vercel's
dashboard, or run `vercel` from the command line. No build settings
are required — Vercel detects the static files and the `/api`
folder automatically. Add your environment variables (above) before
or after the first deploy; redeploy after adding them.

## Privacy notes

- All trackers (water, feedings, mood, diary, village, care) save
  only to the browser's `localStorage`. Nothing is sent anywhere.
- The trusted-source search sends only the typed query text to
  Google's Custom Search API to retrieve results. It is not logged
  or stored by this app. Review Google's own data handling if this
  matters for your privacy policy.
