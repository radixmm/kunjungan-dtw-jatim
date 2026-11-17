-- Skema basis data pencatatan kunjungan DTW (PostgreSQL 15+ / PGlite).
-- Prinsip: TIDAK menyimpan email mentah. Pengunjung diwakili visitor_hash = HMAC-SHA256(EMAIL_PEPPER, email).

CREATE TABLE IF NOT EXISTS checkin (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- waktu diterima server
  visit_at      TIMESTAMPTZ NOT NULL,                -- waktu kunjungan (waktu perangkat bila antre offline)
  visit_date    DATE NOT NULL,                       -- tanggal WIB, kunci "sekali per DTW per hari"
  dtw_kode      TEXT NOT NULL,
  visitor_hash  TEXT NOT NULL,
  pax           INT  NOT NULL CHECK (pax BETWEEN 0 AND 200),
  kategori      TEXT NOT NULL CHECK (kategori IN ('keluarga','travel_agent','rombongan_pribadi','sendiri')),
  is_guide      BOOLEAN NOT NULL DEFAULT false,      -- pemandu mendaftarkan seluruh rombongan
  linked_group  BOOLEAN NOT NULL DEFAULT false,      -- anggota rombongan yang sudah didaftarkan pemandu (pax = 0)
  group_code    TEXT,
  asal_tipe     TEXT NOT NULL CHECK (asal_tipe IN ('wisnus','wisman')),
  asal_prov     TEXT,                                -- kode provinsi Kemendagri, mis. 35
  asal_kab      TEXT,                                -- kode kab/kota Kemendagri, mis. 35.73
  asal_negara   TEXT,                                -- ISO 3166-1 alpha-2, mis. NL
  lang          TEXT,
  qr_mode       TEXT NOT NULL,                       -- statis | dinamis
  geo_status    TEXT NOT NULL,                       -- ok | jauh | ditolak | tidak_ada
  geo_dist_m    INT,
  offline       BOOLEAN NOT NULL DEFAULT false,
  flags         TEXT NOT NULL DEFAULT '',            -- daftar bendera mutu dipisah koma
  consent_ver   TEXT NOT NULL,
  demo          BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT satu_per_dtw_per_hari UNIQUE (visitor_hash, dtw_kode, visit_date)
);
CREATE INDEX IF NOT EXISTS checkin_date_idx    ON checkin (visit_date, dtw_kode);
CREATE INDEX IF NOT EXISTS checkin_visitor_idx ON checkin (visitor_hash, visit_at);
CREATE INDEX IF NOT EXISTS checkin_group_idx   ON checkin (group_code) WHERE group_code IS NOT NULL;

-- Laporan manual kab/kota per DTW per bulan (impor dari sheet DATABASE), pembanding cakupan scan.
CREATE TABLE IF NOT EXISTS laporan_manual (
  bulan     CHAR(7) NOT NULL,          -- YYYY-MM
  dtw_kode  TEXT NOT NULL,
  wisnus    INT NOT NULL DEFAULT 0,
  wisman    INT NOT NULL DEFAULT 0,
  sumber    TEXT,
  PRIMARY KEY (bulan, dtw_kode)
);

-- Jejak permintaan hak subjek data (UU 27/2022): penghapusan/penarikan persetujuan.
CREATE TABLE IF NOT EXISTS permintaan_subjek (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  jenis     TEXT NOT NULL,             -- hapus
  jumlah    INT NOT NULL               -- baris yang dianonimkan
);

-- ======================= Pencatatan dari sisi DTW =======================

-- Akun petugas DTW, verifikator kab/kota, dan admin provinsi (selain ADMIN_EMAILS di environment).
CREATE TABLE IF NOT EXISTS pengguna (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  peran       TEXT NOT NULL CHECK (peran IN ('admin','verifikator','petugas')),
  kab         TEXT,                 -- verifikator: nama kab/kota seperti di data DTW, mis. "Kota Batu"
  dtw_kode    TEXT,                 -- petugas: DTW yang dicatat
  nama        TEXT,
  dibuat_oleh TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pengguna_uniq ON pengguna (lower(email), peran, coalesce(kab, ''), coalesce(dtw_kode, ''));

-- Ketukan tombol hitung petugas (+1 wisnus, +1 wisman, +rombongan). Bantu mengisi rekap harian.
CREATE TABLE IF NOT EXISTS hitung_petugas (
  id         BIGSERIAL PRIMARY KEY,
  client_id  TEXT UNIQUE,            -- id dari perangkat, mencegah ganda saat kirim ulang offline
  dtw_kode   TEXT NOT NULL,
  waktu      TIMESTAMPTZ NOT NULL,
  tanggal    DATE NOT NULL,
  wisnus     INT NOT NULL DEFAULT 0, -- boleh negatif (tombol batal)
  wisman     INT NOT NULL DEFAULT 0,
  petugas    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hitung_dtw_idx ON hitung_petugas (dtw_kode, tanggal);

-- Angka resmi harian per DTW. Sumber: petugas (rekap harian), scan (dari check-in QR), online (TNBTS dll).
CREATE TABLE IF NOT EXISTS rekap_harian (
  dtw_kode           TEXT NOT NULL,
  tanggal            DATE NOT NULL,
  wisnus             INT NOT NULL DEFAULT 0 CHECK (wisnus >= 0),
  wisman             INT NOT NULL DEFAULT 0 CHECK (wisman >= 0),
  sumber             TEXT NOT NULL CHECK (sumber IN ('petugas','scan','online')),
  catatan            TEXT,
  diisi_oleh         TEXT,
  diisi_at           TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'diajukan' CHECK (status IN ('diajukan','terverifikasi','ditolak')),
  diverifikasi_oleh  TEXT,
  diverifikasi_at    TIMESTAMPTZ,
  catatan_verifikasi TEXT,
  PRIMARY KEY (dtw_kode, tanggal)
);

-- Periode libur: verifikasi kab/kota wajib harian (di luar periode ini: mingguan).
CREATE TABLE IF NOT EXISTS periode_libur (
  id          BIGSERIAL PRIMARY KEY,
  nama        TEXT NOT NULL,
  mulai       DATE NOT NULL,
  selesai     DATE NOT NULL,
  dibuat_oleh TEXT
);

-- Jejak aktivitas petugas/verifikator/admin (akuntabilitas data).
CREATE TABLE IF NOT EXISTS log_aktivitas (
  id       BIGSERIAL PRIMARY KEY,
  at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  email    TEXT,
  aksi     TEXT NOT NULL,
  dtw_kode TEXT,
  detail   TEXT
);
