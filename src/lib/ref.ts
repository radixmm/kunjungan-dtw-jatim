import dtwData from "../../data/dtw.json";
import pilotData from "../../data/pilot.json";
import wilayahData from "../../data/wilayah.json";

export type Dtw = {
  id: string; nama: string; kab: string; kategori: string; subkategori?: string; deskripsi?: string;
  kecamatan?: string; desa?: string; buka?: string; tutup?: string; ll?: [number, number]; gmaps?: string;
  dpp?: number; kspp?: number[]; harga_min?: number; harga_max?: number; bertiket?: boolean | number;
  musala?: string | boolean; disabilitas?: string | boolean; toilet?: string | boolean;
  v25?: number[]; v26?: number[];
};
export type Umkm = { nama: string; jenis?: string; lokasi?: string; wa?: string };
export type Jalur = "petugas" | "scan" | "online";
export type Pilot = { kode: string; radius_m?: number; qr?: string; jalur: Jalur; alasan?: string; umkm: Umkm[] };
export const JALUR_LABEL: Record<Jalur, string> = { petugas: "Rekap petugas", scan: "Scan wisatawan", online: "Sistem tiket online" };
export const jalurOf = (kode: string): Jalur => (PILOT_MAP.get(kode)?.jalur ?? "scan");

type KabInfo = { bakorwil: string | null; bakorwil_nama: string | null; dpp: number | null };

const D = dtwData as unknown as { meta: { dpp: Record<string, string>; kspp: Record<string, string>; diperbarui: string }; kab: Record<string, KabInfo>; dtw: Dtw[] };

export const META = D.meta;
export const KAB = D.kab;
export const DTW: Map<string, Dtw> = new Map(D.dtw.map((d) => [d.id, d]));
export const PILOT: Pilot[] = (pilotData as { dtw: Pilot[] }).dtw;
export const PILOT_MAP = new Map(PILOT.map((p) => [p.kode, p]));
export const WILAYAH = wilayahData as unknown as { provinsi: { kode: string; nama: string; kab: [string, string][] }[] };

const kabNama = new Map<string, string>();
const provNama = new Map<string, string>();
for (const p of WILAYAH.provinsi) { provNama.set(p.kode, p.nama); for (const [k, n] of p.kab) kabNama.set(k, n); }
export const namaProv = (k?: string | null) => (k && provNama.get(k)) || k || "";
export const namaKabAsal = (k?: string | null) => (k && kabNama.get(k)) || k || "";
export const kabValid = (prov: string, kab: string) => kab.startsWith(prov + ".") && kabNama.has(kab);
export const provValid = (prov: string) => provNama.has(prov);

export const dppLabel = (n?: number | null) => (n ? D.meta.dpp[String(n)] : null);
export const ksppLabel = (n: number) => D.meta.kspp[String(n)];

/** Info wilayah lengkap untuk satu DTW (Bakorwil, DPP, KSPP). */
export function wilayahDtw(d: Dtw) {
  const k = KAB[d.kab] || { bakorwil: null, bakorwil_nama: null, dpp: null };
  return {
    bakorwil: k.bakorwil || "",
    bakorwilNama: k.bakorwil_nama || "",
    dpp: d.dpp ?? null,
    kspp: d.kspp || [],
  };
}

/** Data yang aman dikirim ke peramban pengunjung (tanpa data internal). */
export function publicDtw(d: Dtw) {
  const p = PILOT_MAP.get(d.id);
  return {
    id: d.id, nama: d.nama, kab: d.kab, kategori: d.kategori, subkategori: d.subkategori || null,
    deskripsi: d.deskripsi || null, lokasi: [d.desa, d.kecamatan].filter(Boolean).join(", ") || null,
    buka: d.buka || null, tutup: d.tutup || null, ll: d.ll || null, gmaps: d.gmaps || null,
    harga: d.harga_min != null || d.harga_max != null ? [d.harga_min ?? null, d.harga_max ?? null] : null,
    bertiket: !!d.bertiket,
    fasilitas: { musala: d.musala || null, disabilitas: d.disabilitas || null, toilet: d.toilet || null },
    dpp: dppLabel(d.dpp), kspp: (d.kspp || []).map(ksppLabel),
    umkm: p?.umkm || [],
  };
}
export type PublicDtw = ReturnType<typeof publicDtw>;
