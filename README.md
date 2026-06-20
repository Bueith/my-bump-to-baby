# Nurture — setup notes

## Running locally with Live Server (no search, no real login)

Open this folder in VS Code, right-click `index.html`, choose
"Open with Live Server." The marketing page, onboarding, and the app
dashboard render and work for localStorage-only testing. The trusted
search button and real password login will NOT work under Live
Server, since both need the serverless functions in `/api` — see
below for those.

## Running locally with search AND login working

Live Server only serves static files; it cannot run the functions in
`/api/search.js` or `/api/auth.js`. To test either locally:

1. Install the Vercel CLI: `npm install -g vercel`
2. From this folder, run: `vercel dev`
3. Open the local URL it gives you (usually `http://localhost:3000`)

## Setting up trusted-source search (Serper.dev)

The search feature calls Serper.dev (a Google Search API wrapper) at
`/api/search.js`, restricted to a trusted-source allowlist and
ranked into two tiers so the single best match is highlighted:

- **Tier 1 — medically reviewed clinical authorities**: `nhs.uk`,
  `acog.org`
- **Tier 2 — trusted pregnancy/parenting sources**: `mayoclinic.org`,
  `kidshealth.org`, `babycenter.com`, `whattoexpect.com`,
  `peanut-app.io`

1. Sign up at https://serper.dev (free tier, no credit card) and
   copy your API key from the dashboard.
2. Locally: add to `.env.local` in this folder:
   ```
   SERPER_API_KEY=your_key_here
   ```
3. On Vercel: Settings -> Environment Variables -> add the same key
   for Production, Preview, and Development -> redeploy.

## Setting up the password login system (Firebase Admin)

The Web Password login (`/api/auth.js`) needs server-side access to
Firestore via the Firebase Admin SDK -- this is separate from the
client-side Firebase config already embedded in `index.html`, and
requires its own credential.

1. In the Firebase console, go to your project -> Project Settings
   -> Service Accounts tab.
2. Click "Generate new private key" -- this downloads a JSON file.
   Treat this file like a master password; never commit it to git.
3. Open that JSON file and copy its entire contents as one string.
4. Locally: add to `.env.local`:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...", ...the full JSON, all on one line...}
   ```
5. On Vercel: Settings -> Environment Variables -> add
   `FIREBASE_SERVICE_ACCOUNT_KEY` with the same full JSON string, for
   Production, Preview, and Development -> redeploy.

### How the password system works

- Passwords are never stored or compared as plain text anywhere.
  `/api/auth.js` hashes them server-side (Node's built-in scrypt,
  with a random salt per password) before saving to Firestore, and
  verification re-hashes the entered password and compares hashes --
  never the raw password.
- The Android app calls `/api/auth` with `action: "set"` when the
  user creates or resets their Web Password.
- The website calls `/api/auth` with `action: "verify"` on every
  login attempt (the standalone login page, and the auth overlay
  shown to returning browsers). Only on success does the website
  receive the user's actual synced data.
- A browser may remember an access code for convenience (so it's
  pre-filled in the password box), but this is purely cosmetic --
  every fresh page load requires the password to be verified again
  before any real data is fetched or displayed. The app shell is
  visually blurred behind a login overlay until that happens.

## Deploying to Vercel

Push this folder to a GitHub repo and import it in Vercel's
dashboard, or run `vercel` from the command line. No build settings
are required -- Vercel detects the static files and the `/api`
folder automatically. Add the environment variables above
(`SERPER_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`) before or after
the first deploy; redeploy after adding them.

## Privacy notes

- Local trackers (mood, sleep, logs, diary, village, care) save to
  the browser's localStorage for offline-first speed, and sync to
  Firestore only once a session is unlocked with a verified Web
  Password.
- The trusted-source search sends only the typed query text to
  Serper.dev. It is not logged or stored by this app.
- The remembered access code (for login-form convenience) is stored
  separately from app data and never grants access by itself -- it
  only pre-fills a text field. The password is what actually
  authorizes access, checked server-side on every fresh page load.
