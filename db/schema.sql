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
