import { q } from "./db";
import { DTW, PILOT, jalurOf, type Jalur } from "./ref";
import { addDays, wibDate } from "./time";

export type RekapRow = {
  dtw_kode: string; tanggal: string; wisnus: number; wisman: number; sumber: Jalur; catatan: string | null;
  diisi_oleh: string | null; status: "diajukan" | "terverifikasi" | "ditolak"; diverifikasi_oleh: string | null; catatan_verifikasi: string | null;
};

/** Senin awal pekan (WIB) untuk tanggal YYYY-MM-DD. */
export function weekStart(date: string) {
  const d = new Date(date + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Senin = 0
  return addDays(date, -dow);
}

/**
 * DTW jalur "scan": angka resmi = jumlah orang dari check-in QR. Rekap hariannya dibuat/diperbarui otomatis
 * (kecuali yang sudah diverifikasi) supaya bisa diverifikasi kab/kota seperti jalur lain.
 */
export async function syncScanRekap(from: string, to: string, kodes?: string[]) {
  const scanKodes = (kodes ?? PILOT.map((p) => p.kode)).filter((k) => jalurOf(k) === "scan");
  if (!scanKodes.length) return;
  const today = wibDate();
  await q(`
    INSERT INTO rekap_harian (dtw_kode, tanggal, wisnus, wisman, sumber, diisi_oleh, diisi_at, status)
    SELECT dtw_kode, visit_date, sum(CASE WHEN asal_tipe='wisnus' THEN pax ELSE 0 END)::int, sum(CASE WHEN asal_tipe='wisman' THEN pax ELSE 0 END)::int,
           'scan', 'otomatis dari scan QR', now(), 'diajukan'
    FROM checkin
    WHERE visit_date BETWEEN $1::date AND $2::date AND visit_date < $4::date AND dtw_kode = ANY(string_to_array($3, ','))
    GROUP BY dtw_kode, visit_date
    ON CONFLICT (dtw_kode, tanggal) DO UPDATE SET wisnus = EXCLUDED.wisnus, wisman = EXCLUDED.wisman, diisi_at = now()
    WHERE rekap_harian.status <> 'terverifikasi' AND rekap_harian.sumber = 'scan'`,
    [from, to, scanKodes.join(","), today]);
}

export async function getRekap(from: string, to: string, kodes: string[]) {
  if (!kodes.length) return [];
  return q<RekapRow>(`SELECT dtw_kode, tanggal::text AS tanggal, wisnus, wisman, sumber, catatan, diisi_oleh, status, diverifikasi_oleh, catatan_verifikasi
    FROM rekap_harian WHERE tanggal BETWEEN $1::date AND $2::date AND dtw_kode = ANY(string_to_array($3, ',')) ORDER BY tanggal`, [from, to, kodes.join(",")]);
}

export async function getLibur(from?: string, to?: string) {
  return q<{ id: number; nama: string; mulai: string; selesai: string }>(
    `SELECT id, nama, mulai::text AS mulai, selesai::text AS selesai FROM periode_libur
     WHERE ($1::date IS NULL OR selesai >= $1::date) AND ($2::date IS NULL OR mulai <= $2::date) ORDER BY mulai`, [from ?? null, to ?? null]);
}

export const isLibur = (date: string, libur: { mulai: string; selesai: string }[]) => libur.some((l) => date >= l.mulai && date <= l.selesai);

/**
 * Batas verifikasi: hari libur → paling lambat akhir hari berikutnya; hari biasa → Selasa setelah pekan itu berakhir.
 * Mengembalikan true bila tanggal itu sudah lewat batas dan belum diverifikasi.
 */
export function verifikasiTerlambat(date: string, libur: { mulai: string; selesai: string }[], today = wibDate()) {
  if (isLibur(date, libur)) return today > addDays(date, 1);
  return today > addDays(weekStart(date), 8);
}

export const namaDtw = (k: string) => DTW.get(k)?.nama || k;
