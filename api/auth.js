// /api/auth.js
//
// Handles Web Password setup (called from the Android app) and
// verification (called from the website login overlay). Passwords
// are never stored or compared in plain text anywhere — this function
// is the only place hashing/verification happens.
//
// Two actions, both POST:
//   { action: "set",    code, password }  -> hash + store password for a code
//   { action: "verify", code, password }  -> check password, return user data on success
//
// Uses Node's built-in crypto (scrypt) — no extra dependency needed,
// unlike search.js's Readability/linkedom packages.

import { initializeApp, getApps } from "firebase-admin/app";
import { cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

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

  const { action, code, password } = req.body || {};

  if (!action || !code || !password) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
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
      // Called from the Android app during setup, or when the user
      // taps "Reset web password" in Settings.
      const snap = await userRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: "Access code not found." });
      }
      const passwordHash = await hashPassword(password);
      await userRef.set({ passwordHash }, { merge: true });
      return res.status(200).json({ success: true });
    }

    if (action === "verify") {
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
      // so the website can populate the app without a second fetch.
      const { passwordHash, ...userData } = data;
      return res.status(200).json({ success: true, userData });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error.", detail: String(err) });
  }
}
