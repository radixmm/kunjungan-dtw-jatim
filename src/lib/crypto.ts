import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";

const b64u = (b: Buffer) => b.toString("base64url");
const hmac = (key: string, msg: string) => createHmac("sha256", key).update(msg).digest();

/** ID pengunjung: HMAC email. Email mentah tidak pernah disimpan. */
export function visitorHash(email: string) {
  return b64u(hmac(config.emailPepper, "email:v1:" + email.trim().toLowerCase())).slice(0, 32);
}

export function maskEmail(email: string) {
  const [u, dom] = email.split("@");
  return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + dom;
}

// ---- QR bertanda tangan ----
// Statis : /c/<kode>?s=<sig(kode)>             dicetak dan ditempel
// Dinamis: /c/<kode>?t=<menit>&s=<sig(kode,t)>  ditampilkan di tablet loket, berganti tiap 60 detik
export function qrSigStatic(kode: string) { return b64u(hmac(config.qrSecret, `qr:v1:${kode}`)).slice(0, 16); }
export function qrSigDynamic(kode: string, t: number) { return b64u(hmac(config.qrSecret, `qr:v1:${kode}:${t}`)).slice(0, 16); }
export const qrWindow = (ms = Date.now()) => Math.floor(ms / 1000 / config.qrWindowSec);

function eq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Memeriksa tanda tangan QR. refMs = waktu pindai (waktu perangkat untuk antrean offline). */
export function verifyQr(kode: string, s?: string | null, t?: string | number | null, refMs = Date.now()): "statis" | "dinamis" | null {
  if (!s) return null;
  if (t == null || t === "") return eq(s, qrSigStatic(kode)) ? "statis" : null;
  const tn = Number(t);
  if (!Number.isInteger(tn) || !eq(s, qrSigDynamic(kode, tn))) return null;
  // QR dinamis berlaku 3 jendela (±3 menit) dari waktu pindai, mencegah foto QR dibagikan.
  return Math.abs(qrWindow(refMs) - tn) <= 3 ? "dinamis" : null;
}

// ---- Sesi (cookie bertanda tangan) ----
const key = () => new TextEncoder().encode(config.sessionSecret);

export async function signSession(payload: Record<string, unknown>, days: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${days}d`).sign(key());
}
export async function readSession<T>(token?: string | null): Promise<T | null> {
  if (!token) return null;
  try { return (await jwtVerify(token, key())).payload as T; } catch { return null; }
}

export const groupCode = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(5), (b) => abc[b % abc.length]).join("");
};

// ---- Tiket pindai ----
// Diterbitkan saat halaman check-in dibuka dari QR yang sah. Berlaku 45 menit sejak pindai, sehingga
// QR dinamis (berganti tiap menit) tidak kedaluwarsa selama pengunjung mengisi formulir.
export async function signScanTicket(kode: string, mode: "statis" | "dinamis") {
  return new SignJWT({ k: kode, m: mode }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("45m").sign(key());
}
export async function verifyScanTicket(token: string | undefined, kode: string, atMs: number): Promise<"statis" | "dinamis" | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { currentDate: new Date(atMs) });
    return payload.k === kode && (payload.m === "statis" || payload.m === "dinamis") ? payload.m : null;
  } catch { return null; }
}
