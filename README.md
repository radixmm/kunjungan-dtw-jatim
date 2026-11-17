# Kunjungan DTW Jatim — Pencatatan Kunjungan Wisatawan berbasis QR

Prototipe pilot untuk Bidang Destinasi Pariwisata, Dinas Kebudayaan dan Pariwisata Provinsi Jawa Timur.

- **Check-in pengunjung** (`/c/<kode DTW>`): pindai QR → login Google satu ketukan → isian grup, kategori, dan asal → persetujuan data (UU 27/2022) → tersimpan. Bahasa ID/EN mengikuti bahasa ponsel.
- **Insentif**: stempel digital *Jatim Pass*, kartu bagikan "Saya sudah ke …", info DTW (fasilitas, peta, UMKM), dan halaman `/paspor`.
- **Dashboard** (`/dashboard`): real-time per DTW, kab/kota, Bakorwil, DPP, KSPP; wisnus/wisman; kategori rombongan; pola perjalanan; cakupan scan vs laporan manual; ekspor rekap bulanan format sheet DATABASE.
- **QR** (`/qr`): lembar QR statis siap cetak dan layar QR dinamis untuk tablet loket.

Rancangan lengkap (database, login, anti-scan-palsu, offline, UU PDP, rencana pilot): **[docs/ARSITEKTUR.md](docs/ARSITEKTUR.md)**.

## Menjalankan

```bash
npm install
```

```bash
npm run dev
```

Buka http://localhost:3000. Tanpa `.env`, aplikasi berjalan dalam **mode demo**: login Google diganti isian email uji, dashboard terbuka tanpa login, basis data memakai PGlite lokal (folder `.pglite/`), dan tombol "Isi data simulasi" di dashboard mengisi data 30 hari bertanda demo.

## Produksi

Salin `.env.example` menjadi `.env` lalu isi `GOOGLE_CLIENT_ID`, `DATABASE_URL`, `EMAIL_PEPPER`, `QR_SECRET`, `SESSION_SECRET`, dan `ADMIN_EMAILS`. Setelah `GOOGLE_CLIENT_ID` terisi, mode demo mati otomatis dan ketiga rahasia wajib diisi. Lihat §3.2 dokumen arsitektur soal lokasi data (PP 71/2019).

## Struktur

| Lokasi | Isi |
|---|---|
| `db/schema.sql` | Skema PostgreSQL |
| `data/dtw.json` | 1.549 DTW + Bakorwil + DPP/KSPP (tanpa kontak pengelola), dibangun oleh `scripts/build_reference.py` |
| `data/wilayah.json` | 38 provinsi, 514 kab/kota (kode Kemendagri, paket `idn-area-data`) |
| `data/pilot.json` | Daftar DTW pilot, radius verifikasi lokasi, UMKM |
| `src/lib/checkin.ts` | Aturan check-in: QR, identitas, validasi, lokasi, perjalanan mustahil, dedup |
| `src/lib/stats.ts` | Agregasi dashboard, pola perjalanan, cakupan |
| `src/app/api/export` | Rekap bulanan .xlsx/.csv |
| `public/sw.js` | Service worker untuk mode offline |

## Memperbarui data referensi

```bash
python3 -I scripts/build_reference.py <data.json Peta Wisata Jatim> <folder idn-area-data/data>
```
