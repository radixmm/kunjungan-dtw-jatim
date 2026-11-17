import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Verifikasi ID token Google Identity Services di server. Mengembalikan email terverifikasi. */
export async function verifyGoogleIdToken(credential: string, clockToleranceSec = 60) {
  const { payload } = await jwtVerify(credential, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.googleClientId,
    clockTolerance: clockToleranceSec,
  });
  const email = String(payload.email || "");
  if (!email || payload.email_verified !== true) throw new Error("Email Google belum terverifikasi");
  return { email };
}
