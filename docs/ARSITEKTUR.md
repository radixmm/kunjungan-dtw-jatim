# Arsitektur Sistem Pencatatan Kunjungan DTW berbasis QR

Bidang Destinasi Pariwisata, Dinas Kebudayaan dan Pariwisata Provinsi Jawa Timur
Versi rancangan: 17 November 2026 (pilot 5–10 DTW)

---

## 1. Ringkasan keputusan

| Aspek | Keputusan pilot | Alasan singkat |
|---|---|---|
| Aplikasi | Web app (Next.js) dibuka dari QR, tanpa instal aplikasi | Pengunjung tidak mau mengunduh aplikasi untuk sekali kunjungan; satu kode untuk halaman pengunjung, dashboard, dan API |
| Basis data | PostgreSQL (satu skema, `db/schema.sql`) | Kuat untuk agregasi (wilayah, pola perjalanan, window function), tersedia di semua penyedia termasuk pusat data dalam negeri |
| Identitas | Google Identity Services (One Tap / tombol), diverifikasi di server | Satu ketukan, email terverifikasi, tanpa kata sandi |
| Privasi | Email **tidak disimpan**; diganti `visitor_hash` = HMAC-SHA256(kunci rahasia, email) | Cukup untuk "sekali per DTW per hari" dan pola perjalanan; meminimalkan data pribadi |
| Aturan hitung | Unik per (`visitor_hash`, DTW, tanggal WIB), dijaga *constraint* basis data | Tidak bisa dilanggar walau ada permintaan ganda bersamaan |
| Anti-scan-palsu | Berlapis: QR bertanda tangan, QR dinamis di loket, verifikasi lokasi, deteksi perjalanan mustahil, batas grup | Tidak ada satu cara yang sempurna; data diberi status mutu, bukan langsung ditolak |
| Offline | Halaman tersimpan (service worker) + antrean isian di perangkat, dikirim saat online | Sinyal di kawasan alam (Bromo, Ijen, pantai selatan) sering lemah |
| Real-time | Dashboard memuat ulang tiap 10 detik | Cukup untuk pilot; bisa ditingkatkan ke *server-sent events* |
| Hosting | Vercel (akun Disbudpar sudah terhubung) untuk pilot; produksi menyesuaikan ketentuan lokasi data (lihat §3.2) | Cepat diluncurkan; keputusan lokasi data perlu koordinasi Diskominfo |

---

## 2. Gambaran komponen

```
 Pengunjung (ponsel)                         Petugas Disbudpar / Kab-Kota
 ───────────────────                         ────────────────────────────
 Kamera → QR DTW                              Dashboard (/dashboard)
   │  /c/DT.13.0002?s=<tanda tangan>            │  login Google + daftar email petugas
   ▼                                            ▼
 Halaman check-in (ID/EN otomatis)           /api/stats  (agregat, tanpa identitas)
   1 Login Google (One Tap)                  /api/export (rekap bulanan format DATABASE)
   2 Isian grup, kategori, asal              /qr         (lembar QR cetak + QR dinamis loket)
   3 Persetujuan UU 27/2022 (+ lokasi opsional)
   │                                                     │
   ▼                                                     ▼
 /api/checkin ──► verifikasi QR/tiket ──► verifikasi ID token Google ──► hash email
              ──► validasi isian ──► cek lokasi & perjalanan mustahil ──► INSERT … ON CONFLICT DO NOTHING
                                                     │
                                                     ▼
                                     PostgreSQL: checkin, laporan_manual, permintaan_subjek
                                                     ▲
                    Data referensi (berkas, ikut aplikasi):
                    data/dtw.json   1.549 DTW, Bakorwil, DPP/KSPP (dari Peta Wisata Jatim)
                    data/wilayah.json  38 provinsi, 514 kab/kota (kode Kemendagri)
                    data/pilot.json DTW pilot, radius lokasi, daftar UMKM
```

Setelah tersimpan, pengunjung melihat **stempel Paspor Wisata Jatim**, tombol **bagikan kartu "Saya sudah ke …"**, info DTW (deskripsi, jam buka, tiket, fasilitas, peta, DPP/KSPP), dan daftar UMKM.

---

## 3. Basis data

### 3.1 Skema inti (`db/schema.sql`)

`checkin` — satu baris per akun per DTW per hari:

| Kolom | Isi |
|---|---|
| `visit_at`, `visit_date` | Waktu kunjungan; tanggal WIB menjadi kunci "sekali per hari" |
| `dtw_kode` | Kode DTW (mis. `DT.13.0002`) |
| `visitor_hash` | HMAC email (32 karakter). **Bukan** email |
| `pax` | Jumlah orang dalam grup (0 untuk anggota rombongan yang sudah didaftarkan pemandu) |
| `kategori` | `keluarga` / `travel_agent` / `rombongan_pribadi` / `sendiri` |
| `is_guide`, `linked_group`, `group_code` | Mekanisme check-in pemandu (lihat §6) |
| `asal_tipe` | `wisnus` / `wisman` berdasarkan **tempat tinggal**, bukan kewarganegaraan (sejalan dengan definisi BPS/UNWTO) |
| `asal_prov`, `asal_kab`, `asal_negara` | Kode Kemendagri (mis. `35`, `35.78`) atau ISO 3166 (mis. `NL`) |
| `qr_mode`, `geo_status`, `geo_dist_m`, `flags`, `offline` | Status mutu/verifikasi. **Koordinat pengunjung tidak disimpan**, hanya jarak ke DTW |
| `consent_ver` | Versi naskah persetujuan yang disetujui |

Constraint `UNIQUE (visitor_hash, dtw_kode, visit_date)` membuat aturan "satu email sekali per DTW per hari" dijamin basis data.

`laporan_manual` — angka laporan kab/kota per DTW per bulan, diimpor dari sheet DATABASE, pembanding cakupan scan.
`permintaan_subjek` — jejak penarikan persetujuan/penghapusan (tanpa identitas).

### 3.2 Pilihan penyedia dan lokasi data

Pemprov adalah **Penyelenggara Sistem Elektronik Lingkup Publik**. PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik mewajibkan PSE Lingkup Publik mengelola, memproses, dan menyimpan sistem dan data elektroniknya di wilayah Indonesia, kecuali teknologi penyimpanannya tidak tersedia di dalam negeri (Pasal 20 ayat (2)–(3)). Perpres No. 95 Tahun 2018 tentang SPBE juga mengarahkan pemakaian Pusat Data Nasional.

| Opsi | Cocok untuk | Catatan |
|---|---|---|
| Neon / Supabase via Vercel Marketplace (region Singapura) | Uji teknis pilot, data pseudonim | Tercepat. Lokasi di luar Indonesia, sehingga perlu persetujuan Diskominfo sebagai uji coba terbatas |
| PostgreSQL terkelola region Jakarta (mis. Google Cloud `asia-southeast2`, AWS `ap-southeast-3`) | Produksi | Memenuhi lokasi data; aplikasi tetap bisa di Vercel atau dipindah ke Cloud Run di region yang sama |
| PDN / server Diskominfo Jatim | Produksi jangka panjang | Paling sesuai SPBE; perlu koordinasi penyediaan PostgreSQL dan akses jaringan |

Rekomendasi: **pilot** di Neon/Supabase dengan persetujuan tertulis Diskominfo bahwa ini uji coba terbatas, lalu pindah ke region Jakarta atau PDN sebelum perluasan. Kode tidak perlu diubah karena cukup mengganti `DATABASE_URL`.

Tanpa `DATABASE_URL`, prototipe memakai PGlite (PostgreSQL dalam WASM) di folder lokal. Ini hanya untuk uji coba; di Vercel datanya hilang setiap instans dimulai ulang.

---

## 4. Login Google

1. Halaman memuat Google Identity Services. Akun yang pernah dipakai di ponsel itu langsung muncul sebagai **One Tap** (`auto_select`). Untuk akun baru cukup satu ketukan pada tombol "Lanjutkan dengan Google".
2. Peramban menerima **ID token** (JWT) dan mengirimkannya bersama isian ke `/api/checkin`.
3. Server memverifikasi token dengan kunci publik Google (`jose`): penerbit `accounts.google.com`, *audience* = Client ID Disbudpar, belum kedaluwarsa, dan `email_verified = true`.
4. Email langsung diubah menjadi `visitor_hash` dan **tidak pernah ditulis** ke basis data atau log. Kunci HMAC (`EMAIL_PEPPER`) disimpan terpisah dari basis data, sehingga salinan basis data yang bocor tidak bisa dicocokkan dengan daftar email.
5. Server memasang cookie sesi bertanda tangan (180 hari, `httpOnly`) berisi hash dan email tersamar (`ra***@gmail.com`, hanya untuk tampilan). Di DTW berikutnya pengunjung **tidak perlu login lagi**, dan halaman Paspor bisa menampilkan stempelnya.

Persiapan di Google Cloud Console: buat OAuth Client tipe *Web application*, isi *Authorized JavaScript origins* dengan domain aplikasi, dan terbitkan *OAuth consent screen* atas nama Disbudpar Jatim. Hanya cakupan dasar (`openid email`) yang dipakai, sehingga tidak perlu verifikasi aplikasi tambahan dari Google.

Dashboard memakai login Google yang sama, ditambah daftar email/domain petugas (`ADMIN_EMAILS`, mis. `@jatimprov.go.id`). Cookie admin berlaku 1 hari.

---

## 5. Anti-scan-palsu

Prinsipnya berlapis. Hanya pemalsuan yang jelas yang ditolak; selebihnya diberi **status mutu**, sehingga dashboard bisa menampilkan "Semua" atau "Terverifikasi lokasi".

| Lapis | Mekanisme | Mencegah | Tindakan |
|---|---|---|---|
| 1. QR bertanda tangan | URL memuat HMAC dari kode DTW (`?s=`) dengan kunci `QR_SECRET` | Tautan rekaan untuk DTW lain, mengetik URL sendiri | **Tolak** |
| 2. QR dinamis (opsional, per DTW) | Tablet di loket menampilkan QR yang berganti tiap 60 detik (`/qr/<kode>`), berlaku ±3 menit | Foto QR dibagikan di grup WhatsApp/medsos | **Tolak** bila kedaluwarsa |
| 3. Tiket pindai | Membuka QR sah menerbitkan tiket 45 menit, jadi QR dinamis tidak kedaluwarsa saat pengunjung masih mengisi | — (kenyamanan) | — |
| 4. Satu akun sekali/DTW/hari | Constraint unik di basis data | Scan berulang | Scan ulang hanya menampilkan "sudah tercatat" |
| 5. Akun Google terverifikasi | Wajib `email_verified` | Akun asal-asalan | **Tolak** bila tidak terverifikasi |
| 6. Verifikasi lokasi | Jarak ponsel ke titik DTW dibanding radius per DTW (`data/pilot.json`, mis. Bromo 8 km, Museum Angkut 800 m) | Check-in dari rumah dengan QR statis | Status `ok` / `jauh` / `ditolak` / `tidak_ada` |
| 7. Perjalanan mustahil | Dua check-in akun yang sama dengan kecepatan tempuh > 150 km/jam | Satu akun dipakai banyak orang, QR beredar | Bendera `perjalanan_mustahil` |
| 8. Batas grup | Maks. 200 orang; > 30 orang tanpa status pemandu diberi bendera | Angka grup digelembungkan | Bendera `grup_besar` |
| 9. Rate limit jaringan (produksi) | Vercel Firewall / WAF per IP untuk `/api/checkin` | Serangan otomatis | Blokir sementara |

Rekomendasi pilot: **QR statis** di semua DTW, ditambah **QR dinamis** di loket DTW yang punya petugas tiket (Museum Angkut, Bromo, Ijen). Dashboard memisahkan angka semua dan angka terverifikasi supaya efek setiap lapis bisa dievaluasi selama pilot.

---

## 6. Aturan penghitungan

- **Satuan**: jumlah orang (`pax`) yang diisi pengunjung, bukan jumlah scan.
- **Sendiri** → 1 orang.
- **Pemandu travel agent** mencentang "Saya pemandu dan mendaftarkan seluruh rombongan", lalu mengisi jumlah peserta. Sistem memberi **kode rombongan** (5 karakter) yang bisa dibagikan ke peserta.
- **Peserta rombongan** yang tetap ingin stempel mencentang "Pemandu saya sudah mendaftarkan rombongan ini" (opsional dengan kode). Ia tercatat dengan `pax = 0`: tetap mendapat stempel tetapi **tidak dihitung dua kali**.
- **Wisnus/wisman** ditentukan oleh tempat tinggal sehari-hari. WNI yang tinggal di luar negeri dihitung wisman, sedangkan WNA yang tinggal di Indonesia dihitung wisnus (sesuai konsep BPS/UNWTO). Asal grup diasumsikan sama dengan asal pengisi.
- **Tanggal** memakai WIB (Asia/Jakarta).

---

## 7. Mode offline

| Situasi | Perilaku |
|---|---|
| Sinyal lemah tapi ada | Halaman ringan (tanpa gambar besar); pengiriman diulang otomatis |
| Halaman pernah dibuka lalu sinyal hilang | Service worker menampilkan salinan tersimpan; isian masuk **antrean di perangkat** dengan waktu pindai asli |
| Belum login dan offline | Tombol "Isi dulu, kirim nanti". Login Google diminta saat online, lalu antrean terkirim |
| Antrean dikirim | Server menerima waktu perangkat paling lama 72 jam ke belakang dan memberi tanda `offline` |
| Pertama kali membuka QR tanpa sinyal sama sekali | **Tidak bisa** untuk aplikasi web (halaman belum pernah terunduh). Solusi lapangan: Wi-Fi gratis di loket (sejalan dengan insentif Wi-Fi tahap berikutnya) atau penempatan QR di titik bersinyal (pintu masuk/parkir) |

Token Google tidak disimpan di perangkat. Antrean dikirim memakai cookie sesi atau login ulang.

---

## 8. Pelindungan data pribadi (UU No. 27 Tahun 2022)

| Kewajiban | Penerapan di sistem |
|---|---|
| Dasar pemrosesan: persetujuan eksplisit (Pasal 20 ayat (2) huruf a) | Langkah 3 wajib dicentang; versi naskah disimpan (`consent_ver`) |
| Informasi sebelum persetujuan: tujuan, jenis data, masa simpan, hak subjek (Pasal 21) | Naskah persetujuan ID/EN di halaman check-in dan `/privasi` |
| Prinsip terbatas, spesifik, sesuai tujuan, dan minimal (Pasal 16 ayat (2)) | Email tidak disimpan, koordinat tidak disimpan, dashboard hanya menampilkan agregat |
| Data anak memerlukan persetujuan orang tua/wali (Pasal 25) | Konfirmasi "18 tahun ke atas atau mendapat izin orang tua/wali" |
| Hak menarik persetujuan dan menghapus (Pasal 8–9) | Tombol di halaman Paspor memutus kaitan seluruh baris dari akun (hash diganti nilai acak) |
| Penilaian dampak (DPIA) untuk pemantauan sistematis/skala besar (Pasal 34) | **Perlu disusun** sebelum perluasan, karena analisis pola perjalanan termasuk pemantauan pergerakan |
| Pejabat Pelindungan Data Pribadi untuk pelayanan publik (Pasal 53) | Kontak PPDP Disbudpar dicantumkan di `/privasi` sebelum peluncuran |
| Pemberitahuan kegagalan pelindungan 3×24 jam (Pasal 46) | Masukkan ke SOP insiden bersama Diskominfo |
| Anonimitas agregat | `MIN_CELL` menyembunyikan pasangan pola perjalanan dengan jumlah kecil (rekomendasi produksi: 5) |

Insentif disusun **bukan undian**: semua pengunjung mendapat stempel yang sama, tanpa unsur untung-untungan. Karena itu tidak memerlukan izin undian berdasarkan UU No. 22 Tahun 1954 tentang Undian. Bila tahap voucher UMKM nanti memakai kuota terbatas, gunakan prinsip "siapa cepat dia dapat" atau "semua yang memenuhi syarat", jangan diundi.

> Pasal-pasal di atas dirujuk dari naskah UU 27/2022. Mohon verifikasi akhir oleh Biro Hukum / PPDP sebelum naskah persetujuan ditetapkan.

---

## 9. Dashboard dan ekspor

- **Real-time** (muat ulang 10 detik): wisatawan, wisnus/wisman, akun unik, persentase lokasi terverifikasi, rombongan travel agent.
- **Grafik** per jam (hari ini) atau per hari (rentang).
- **Per DTW**, **per wilayah** (Kab/Kota, Bakorwil, DPP, KSPP sesuai Perda Prov. Jatim No. 6 Tahun 2017), **kategori rombongan**, **asal** (provinsi, kab/kota, negara).
- **Pola perjalanan**: pasangan DTW berurutan oleh akun yang sama dalam 3 hari, jeda rata-rata, dan persentase akun multi-DTW.
- **Cakupan scan** = orang tercatat via QR ÷ laporan manual kab/kota pada bulan yang sama.
- **Mutu data**: status lokasi, bendera, pengiriman offline, dan QR dinamis.
- **Ekspor rekap bulanan** (.xlsx/.csv) dengan kolom `BULAN | BAKORWIL | KABUPATEN/KOTA | KATEGORI | KODE DTW | DTW | WISMAN | WISNUS | KET`. Format bulan mengikuti sheet (`11.NOV`). KET berisi jumlah check-in dan persentase terverifikasi.

Email tidak pernah dikirim ke dashboard. Umpan "check-in terbaru" hanya berisi jam, DTW, jumlah orang, kategori, dan daerah asal.

---

## 10. Rencana pilot (usulan 8 DTW, 8 minggu)

| DTW | Kode | DPP | Alasan |
|---|---|---|---|
| Kawasan Gunung Bromo | DT.13.0002 | 2 | Wisman tinggi, kawasan luas, sinyal tidak merata |
| Kawah Ijen Banyuwangi | DT.10.0028 | 4 | Wisman tinggi, uji mode offline |
| Museum Angkut | DT.79.0022 | 2 | Berloket, uji QR dinamis |
| Candi Penataran | DT.05.0012 | 3 | Cagar budaya |
| Goa Gong | DT.01.0001 | 3 | Data fasilitas lengkap |
| Telaga Sarangan | DT.20.0001 | 3 | Wisnus sangat tinggi |
| Wisata Religi Sunan Ampel | DT.78.0020 | 1 | Religi perkotaan, volume besar |
| Pantai Lombang | DT.29.0014 | 5 | Mewakili Madura |

Daftar ini bisa diubah di `data/pilot.json`.

Tahapan:
1. **Minggu 0**: OAuth Client Google, basis data, rahasia, daftar email petugas, persetujuan Diskominfo, telaah naskah persetujuan oleh PPDP/Biro Hukum.
2. **Minggu 1**: cetak QR (stiker loket, banner titik foto, struk tiket), siapkan tablet QR dinamis, briefing pengelola DTW dan Disbudpar kab/kota.
3. **Minggu 2–7**: operasi. Pantau dashboard harian dan evaluasi mingguan cakupan scan serta mutu data.
4. **Minggu 8**: evaluasi. Bandingkan cakupan dengan laporan manual, persentase terverifikasi, dan masukan pengunjung; putuskan perluasan.

Indikator keberhasilan (usulan): cakupan scan ≥ 10% dari laporan manual di DTW berloket, ≥ 70% check-in berstatus lokasi cocok, median waktu check-in < 60 detik.

---

## 11. Tahap berikutnya

- **Voucher UMKM**: voucher bertanda tangan per stempel, ditukar di UMKM mitra dengan memindai QR milik UMKM. Tabel baru `voucher`, `umkm_mitra`.
- **Wi-Fi**: captive portal di loket yang mengarah ke halaman check-in sekaligus menyelesaikan masalah offline pertama kali.
- **Mode petugas**: aplikasi tablet untuk mencatat pengunjung tanpa ponsel (lansia, rombongan sekolah) dan pengiriman massal saat online.
- **Impor laporan manual otomatis** dari sheet DATABASE melalui Google Sheets API.
- **Server-sent events** untuk dashboard yang benar-benar *push*.

---

## 12. Temuan mutu data referensi

Saat membangun `data/dtw.json` dari sheet profil DTW (lewat data Peta Wisata Jatim):

- **9 kode DTW dipakai ganda.** Contoh: `DT.75.0012` dipakai oleh *Makam KH. Abd. Khamid* (Kota Pasuruan) dan *Taman Wisata Studi Lingkungan* (Kota Probolinggo); hal yang sama terjadi pada `DT.75.0013`–`DT.75.0019` dan `DT.75.0024`. Tampaknya DTW Kota Probolinggo memakai awalan kode Kota Pasuruan.
- **2 DTW tanpa kode**: *TITD Kim Hin Kiong* (Kab Gresik) dan *Wisata The Nice PlayLand* (Kab Madiun).

Semua DTW pilot tidak terdampak. Sebelum perluasan, kode-kode ini perlu diperbaiki di sheet sumber karena kode DTW menjadi kunci QR dan rekap.

---

## 13. Rujukan regulasi

| Regulasi | Relevansi | Tautan |
|---|---|---|
| UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi | Persetujuan, hak subjek, DPIA, PPDP | https://peraturan.go.id/id/uu-no-27-tahun-2022 |
| PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik | Lokasi data PSE Lingkup Publik (Pasal 20) | https://peraturan.go.id/id/pp-no-71-tahun-2019 |
| Perpres No. 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis Elektronik | Pusat data, keterpaduan aplikasi | https://peraturan.go.id/id/perpres-no-95-tahun-2018 |
| Perpres No. 39 Tahun 2019 tentang Satu Data Indonesia | Standar data, metadata, kode referensi | https://peraturan.go.id/id/perpres-no-39-tahun-2019 |
| UU No. 10 Tahun 2009 tentang Kepariwisataan | Kewenangan provinsi dalam pendataan dan pengembangan destinasi | https://peraturan.go.id/id/uu-no-10-tahun-2009 |
| Perda Provinsi Jawa Timur No. 6 Tahun 2017 tentang RIPPARPROV Jawa Timur 2017–2032 | DPP, KSPP, DTWP | https://jdih.jatimprov.go.id (cari "Peraturan Daerah Nomor 6 Tahun 2017") |
| UU No. 22 Tahun 1954 tentang Undian | Insentif dirancang bukan undian | https://peraturan.go.id/id/uu-no-22-tahun-1954 |

> Catatan: tautan peraturan.go.id di atas mengikuti pola URL resmi situs tersebut, tetapi belum bisa dibuka dari lingkungan pengembangan ini (akses jaringan dibatasi). Mohon dicek sekali sebelum dokumen diedarkan. Alternatif: JDIH BPK https://peraturan.bpk.go.id.
