import { cookies } from "next/headers";
import { readSession } from "./crypto";
import { isDemo } from "./config";
import { q } from "./db";
import { DTW, PILOT } from "./ref";
import { ADMIN_COOKIE, isAdminEmail } from "./session";

// Petugas DTW, verifikator kab/kota, admin provinsi. Cookie hanya berisi email; peran dibaca dari basis data
// setiap permintaan, sehingga pencabutan akses langsung berlaku.
export type Staff = { email: string; isAdmin: boolean; kabs: string[]; dtws: string[]; demo?: boolean };
export const DEMO_AS_COOKIE = "pwj_demo_as";

export async function rolesFor(email: string): Promise<Omit<Staff, "email">> {
  const rows = await q<{ peran: string; kab: string | null; dtw_kode: string | null }>(
    `SELECT peran, kab, dtw_kode FROM pengguna WHERE lower(email) = lower($1)`, [email]);
  return {
    isAdmin: isAdminEmail(email) || rows.some((r) => r.peran === "admin"),
    kabs: [...new Set(rows.filter((r) => r.peran === "verifikator" && r.kab).map((r) => r.kab!))],
    dtws: [...new Set(rows.filter((r) => r.peran === "petugas" && r.dtw_kode).map((r) => r.dtw_kode!))],
  };
}

export async function getStaff(): Promise<Staff | null> {
  const jar = await cookies();
  if (isDemo()) {
    // Mode demo: bisa berpura-pura menjadi verifikator/petugas untuk mencoba tampilan tiap peran.
    const as = jar.get(DEMO_AS_COOKIE)?.value || "admin";
    if (as.startsWith("verifikator:")) return { email: "demo-verifikator", isAdmin: false, kabs: [as.slice(12)], dtws: [], demo: true };
    if (as.startsWith("petugas:")) return { email: "demo-petugas", isAdmin: false, kabs: [], dtws: [as.slice(8)], demo: true };
    return { email: "demo-admin", isAdmin: true, kabs: [], dtws: [], demo: true };
  }
  const s = await readSession<{ email: string }>(jar.get(ADMIN_COOKIE)?.value);
  if (!s?.email) return null;
  const r = await rolesFor(s.email);
  if (!r.isAdmin && !r.kabs.length && !r.dtws.length) return null;
  return { email: s.email, ...r };
}

/** Kode DTW yang boleh dilihat/diverifikasi: admin = semua DTW pilot + yang punya rekap; verifikator = DTW di kab/kotanya. */
export function canSeeDtw(st: Staff, kode: string) {
  if (st.isAdmin) return true;
  const d = DTW.get(kode);
  return !!d && (st.kabs.includes(d.kab) || st.dtws.includes(kode));
}
export function canVerify(st: Staff, kode: string) {
  if (st.isAdmin) return true;
  const d = DTW.get(kode);
  return !!d && st.kabs.includes(d.kab);
}
export function scopeKodes(st: Staff, extra: string[] = []) {
  const base = [...new Set([...PILOT.map((p) => p.kode), ...extra])];
  return base.filter((k) => canSeeDtw(st, k));
}

export async function logAktivitas(email: string, aksi: string, dtw: string | null, detail?: unknown) {
  await q(`INSERT INTO log_aktivitas (email, aksi, dtw_kode, detail) VALUES ($1, $2, $3, $4)`, [email, aksi, dtw, detail == null ? null : JSON.stringify(detail)]);
}
