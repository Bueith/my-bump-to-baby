// /api/auth.js
//
// Handles Web Password setup (called from the Android app), login
// verification, and session-token validation (both called from the
// website). Passwords are never stored or compared in plain text
// anywhere — this function is the only place hashing/verification
// happens.
//
// Three actions, all POST:
//   { action: "set",    code, password }            -> hash + store password for a code
//   { action: "verify", code, password }             -> check password, return user data + a session token
//   { action: "save",   code, token, data }          -> validate token, write data server-side (the ONLY
//                                                        write path — the client never writes to Firestore
//                                                        directly, since the client SDK has no way to prove
//                                                        the password was checked)
//
// The session token is a signed, time-limited proof that a password
// check already succeeded for this code, generated using HMAC against
// a server-only secret (Node's built-in crypto). It is NOT a password
// substitute long-term — it expires after a few hours and only ever
// authorizes writes to its own access code's document.
//
// Uses Node's built-in crypto (scrypt + hmac) — no extra dependency
// needed, unlike search.js's Readability/linkedom packages.

import { initializeApp, getApps } from "firebase-admin/app";
import { cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes, scrypt as scryptCallback, createHmac, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Firebase Admin SDK init — separate from the client-side Firebase
// config used in index.html. Requires a service account key set as
// an environment variable (FIREBASE_SERVICE_ACCOUNT_KEY, the full
// JSON content as a string) in Vercel project settings.
function getDb() {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not configured.");
    }
    initializeApp({
      credential: cert(JSON.parse(serviceAccountJson))
    });
  }
  return getFirestore();
}

function getSessionSecret() {
  // Falls back to a derivative of the service account key if a
  // dedicated secret isn't set, so this works even before a separate
  // SESSION_SECRET env var is configured — but setting SESSION_SECRET
  // explicitly is recommended for production.
  return process.env.SESSION_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "nurture-fallback-secret";
}

function issueSessionToken(code) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${code}.${expires}`;
  const sig = createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifySessionToken(code, token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [tokenCode, expiresStr, sig] = parts;
    if (tokenCode !== code) return false;
    const expires = parseInt(expiresStr, 10);
    if (!expires || Date.now() > expires) return false;

    const expectedPayload = `${tokenCode}.${expiresStr}`;
    const expectedSig = createHmac("sha256", getSessionSecret()).update(expectedPayload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const derivedKey = await scrypt(password, salt, 64);
  const computedHex = derivedKey.toString("hex");
  // Constant-time-ish comparison (lengths already match for scrypt(64)).
  if (computedHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, code, password, token, data: incomingData } = req.body || {};

  if (!action || !code) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const normalizedCode = String(code).toUpperCase().trim();

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(500).json({ error: "Server is not configured for authentication yet." });
  }

  const userRef = db.collection("users").doc(normalizedCode);

  try {
    if (action === "set") {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }
      // Called from the Android app during setup, or when the user
      // taps "Reset web password" in Settings. Creates the user
      // document if this is the very first thing to touch this
      // access code (e.g. password set races the first data sync),
      // rather than requiring some other write to have happened first.
      const passwordHash = await hashPassword(password);
      await userRef.set({ passwordHash, accessCode: normalizedCode }, { merge: true });
      return res.status(200).json({ success: true });
    }

    if (action === "verify") {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }
      const snap = await userRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "That access code wasn't found." });
      }
      const data = snap.data();
      if (!data.passwordHash) {
        return res.status(400).json({ error: "This account hasn't set a web password yet. Set one in the phone app's Settings." });
      }
      const valid = await verifyPassword(password, data.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Incorrect password." });
      }
      // Success — return the user's data (minus the password hash)
      // plus a signed session token. The website stores this token
      // (not the password) and sends it with every subsequent save,
      // so we never need to ask for the password again until it
      // expires or the tab is closed.
      const { passwordHash, ...userData } = data;
      const sessionToken = issueSessionToken(normalizedCode);
      return res.status(200).json({ success: true, userData, token: sessionToken });
    }

    if (action === "save") {
      // The ONLY write path for the website. The client never writes
      // to Firestore directly — the client SDK has no way to prove a
      // password was checked, so direct client writes would either
      // have to be wide open (insecure) or impossible (breaks the
      // app). Routing saves through here, gated by the session token
      // issued at "verify" time, is what actually closes that gap.
      if (!token || !verifySessionToken(normalizedCode, token)) {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
      if (!incomingData || typeof incomingData !== "object") {
        return res.status(400).json({ error: "Missing data to save." });
      }
      // Never let a save overwrite the password hash or access code,
      // regardless of what the client sends — those are only ever
      // touched by "set", never by a regular data save.
      const { passwordHash, accessCode, ...safeData } = incomingData;
      await userRef.set(safeData, { merge: true });
      return res.status(200).json({ success: true });
    }

    if (action === "fetch") {
      // Read the latest data from Firestore, gated by the session token.
      // Used by the website's manual refresh button to pull phone changes
      // without requiring a full logout/login cycle.
      if (!token || !verifySessionToken(normalizedCode, token)) {
        return res.status(401).json({ error: "Session expired. Please log in again." });
      }
      const snap = await userRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Account not found." });
      }
      const { passwordHash, ...userData } = snap.data();
      return res.status(200).json({ success: true, userData });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error.", detail: String(err) });
  }
}
