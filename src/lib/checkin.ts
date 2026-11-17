import { config, isDemo } from "./config";
import { verifyQr, verifyScanTicket, visitorHash, maskEmail, groupCode } from "./crypto";
import { verifyGoogleIdToken } from "./google";
import { q } from "./db";
import { DTW, PILOT_MAP, kabValid, provValid } from "./ref";
import { COUNTRIES } from "./countries";
import { distanceM } from "./geo";
import { wibDate } from "./time";

export type CheckinInput = {
  kode: string; s?: string; t?: string | number | null; ticket?: string;
  credential?: string; demoEmail?: string;
  pax: number; kategori: string; isGuide?: boolean; linkedGroup?: boolean; groupCode?: string;
  asalTipe: "wisnus" | "wisman"; prov?: string; kab?: string; negara?: string;
  consent: boolean; adult: boolean; consentVer?: string;
  geo?: { lat: number; lng: number; acc?: number } | { denied: true } | null;
  clientTime?: string; offline?: boolean; lang?: string;
};

export class CheckinError extends Error { constructor(public code: string, public status = 400) { super(code); } }

const KATEGORI = new Set(["keluarga", "travel_agent", "rombongan_pribadi", "sendiri"]);
const MAX_PAX = 200;

export async function processCheckin(inp: CheckinInput, session: { v: string; m: string } | null) {
  const dtw = DTW.get(inp.kode);
  if (!dtw) throw new CheckinError("dtw_tidak_dikenal", 404);

  // 1. Waktu kunjungan. Antrean offline boleh memakai waktu perangkat, paling lama 72 jam ke belakang.
  const now = Date.now();
  let visitMs = now;
  const flags: string[] = [];
  if (inp.offline && inp.clientTime) {
    const ct = Date.parse(inp.clientTime);
    if (Number.isFinite(ct) && ct <= now + 5 * 60e3 && ct >= now - config.offlineMaxHours * 3600e3) { visitMs = Math.min(ct, now); flags.push("offline"); }
    else flags.push("waktu_offline_ditolak");
  }

  // 2. Tanda tangan QR (anti-QR palsu / tautan rekaan).
  // Utamakan tiket pindai; QR statis tetap sah langsung (mis. halaman dibuka dari cache saat offline).
  const qrMode = (await verifyScanTicket(inp.ticket, inp.kode, visitMs)) || (inp.t ? null : verifyQr(inp.kode, inp.s, null, visitMs));
  if (!qrMode) throw new CheckinError("qr_tidak_valid", 403);

  // 3. Identitas: ID token Google (atau sesi tersimpan). Email langsung di-hash, tidak disimpan.
  let vh: string, masked: string;
  if (inp.credential && !isDemo()) {
    // Token dari antrean offline bisa sudah lewat 1 jam; login ulang tetap diminta saat online, jadi toleransi kecil saja.
    const { email } = await verifyGoogleIdToken(inp.credential).catch(() => { throw new CheckinError("login_tidak_valid", 401); });
    vh = visitorHash(email); masked = maskEmail(email);
  } else if (isDemo() && inp.demoEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.demoEmail)) {
    vh = visitorHash(inp.demoEmail); masked = maskEmail(inp.demoEmail);
  } else if (session) {
    vh = session.v; masked = session.m;
  } else throw new CheckinError("perlu_login", 401);

  // 4. Validasi isian.
  if (!inp.consent || !inp.adult) throw new CheckinError("perlu_persetujuan");
  if (!KATEGORI.has(inp.kategori)) throw new CheckinError("kategori_tidak_valid");
  let pax = Math.floor(Number(inp.pax));
  if (!Number.isFinite(pax) || pax < 1 || pax > MAX_PAX) throw new CheckinError("jumlah_tidak_valid");
  if (inp.kategori === "sendiri") pax = 1;
  const isGuide = inp.kategori === "travel_agent" && !!inp.isGuide;
  const linked = inp.kategori === "travel_agent" && !isGuide && !!inp.linkedGroup;
  if (linked) pax = 0; // anggota rombongan yang sudah didaftarkan pemandu: dapat stempel, tidak dihitung dua kali
  if (!isGuide && pax > 30) flags.push("grup_besar");

  let prov: string | null = null, kab: string | null = null, negara: string | null = null;
  if (inp.asalTipe === "wisnus") {
    if (!inp.prov || !provValid(inp.prov)) throw new CheckinError("provinsi_tidak_valid");
    prov = inp.prov;
    if (inp.kab) { if (!kabValid(prov, inp.kab)) throw new CheckinError("kab_tidak_valid"); kab = inp.kab; }
  } else if (inp.asalTipe === "wisman") {
    if (!inp.negara || !COUNTRIES.includes(inp.negara)) throw new CheckinError("negara_tidak_valid");
    negara = inp.negara;
  } else throw new CheckinError("asal_tidak_valid");

  // 5. Lokasi (opsional). Tidak menolak check-in, hanya memberi status verifikasi.
  let geoStatus = "tidak_ada", geoDist: number | null = null;
  if (inp.geo && "denied" in inp.geo) geoStatus = "ditolak";
  else if (inp.geo && Number.isFinite(inp.geo.lat) && Number.isFinite(inp.geo.lng) && dtw.ll) {
    geoDist = Math.round(distanceM([inp.geo.lat, inp.geo.lng], dtw.ll));
    const radius = PILOT_MAP.get(dtw.id)?.radius_m ?? config.geoRadius;
    geoStatus = geoDist <= radius + Math.min(inp.geo.acc ?? 0, 500) ? "ok" : "jauh";
  }

  // 6. Perjalanan mustahil: check-in di DTW lain dengan kecepatan tempuh > 150 km/jam.
  const prev = await q<{ dtw_kode: string; ms: number }>(
    `SELECT dtw_kode, (extract(epoch FROM visit_at) * 1000)::float8 AS ms FROM checkin
     WHERE visitor_hash = $1 AND visit_at > to_timestamp($2::float8 / 1000) - interval '12 hours' ORDER BY visit_at DESC LIMIT 1`, [vh, visitMs]);
  if (prev[0] && prev[0].dtw_kode !== dtw.id) {
    const a = DTW.get(prev[0].dtw_kode)?.ll, b = dtw.ll;
    if (a && b) {
      const km = distanceM(a, b) / 1000, h = Math.max(Math.abs(visitMs - Number(prev[0].ms)) / 3600e3, 1 / 60);
      if (km / h > 150) flags.push("perjalanan_mustahil");
    }
  }

  const visitDate = wibDate(new Date(visitMs));
  const code = isGuide ? groupCode() : linked && inp.groupCode ? inp.groupCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || null : null;

  const ins = await q<{ id: number }>(
    `INSERT INTO checkin (visit_at, visit_date, dtw_kode, visitor_hash, pax, kategori, is_guide, linked_group, group_code,
       asal_tipe, asal_prov, asal_kab, asal_negara, lang, qr_mode, geo_status, geo_dist_m, offline, flags, consent_ver, demo)
     VALUES (to_timestamp($1::float8 / 1000), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     ON CONFLICT ON CONSTRAINT satu_per_dtw_per_hari DO NOTHING RETURNING id`,
    [visitMs, visitDate, dtw.id, vh, pax, inp.kategori, isGuide, linked, code, inp.asalTipe, prov, kab, negara,
      inp.lang === "en" ? "en" : "id", qrMode, geoStatus, geoDist, flags.includes("offline"), flags.join(","), config.consentVersion, isDemo()]);

  const stamps = await q<{ n: number }>(`SELECT count(DISTINCT dtw_kode)::int AS n FROM checkin WHERE visitor_hash = $1`, [vh]);
  return {
    status: ins.length ? ("tercatat" as const) : ("sudah_tercatat" as const),
    groupCode: ins.length && isGuide ? code : null,
    stamps: stamps[0]?.n ?? 0,
    session: { v: vh, m: masked },
    verified: geoStatus === "ok" && !flags.includes("perjalanan_mustahil"),
  };
}
