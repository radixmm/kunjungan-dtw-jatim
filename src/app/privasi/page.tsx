export const metadata = { title: "Pemberitahuan Privasi · Jatim Pass" };

export default function Privasi() {
  return (
    <main className="ci" style={{ maxWidth: 720 }}>
      <header className="hero" style={{ paddingTop: 20 }}><h1>Pemberitahuan Privasi</h1><span className="loc">Versi 2026-11-v1 · Draf untuk ditelaah Pejabat Pelindungan Data Pribadi dan Biro Hukum</span></header>
      <section className="card small">
        <p><b>Pengendali data:</b> Dinas Kebudayaan dan Pariwisata Provinsi Jawa Timur.</p>
        <p><b>Data yang diproses:</b> kode acak satu arah dari email akun Google (email tidak disimpan), jumlah dan kategori rombongan, provinsi–kabupaten/kota atau negara tempat tinggal, DTW dan waktu kunjungan, bahasa perangkat, serta lokasi saat check-in bila diizinkan (yang disimpan hanya jarak ke DTW dan status verifikasi, bukan koordinat).</p>
        <p><b>Tujuan:</b> statistik kunjungan wisatawan per DTW dan wilayah, analisis agregat pola perjalanan antar-DTW, dan perencanaan destinasi. Data tidak dijual, tidak dibagikan ke pihak ketiga untuk pemasaran, dan tidak ditampilkan per orang di dashboard.</p>
        <p><b>Dasar pemrosesan:</b> persetujuan eksplisit subjek data (Pasal 20 ayat (2) huruf a UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi).</p>
        <p><b>Masa simpan:</b> data rinci paling lama 2 tahun; setelah itu hanya disimpan sebagai angka agregat.</p>
        <p><b>Hak Anda:</b> mengakses, memperbaiki, menarik persetujuan, dan meminta penghapusan. Penarikan dapat dilakukan langsung di halaman <a href="/paspor">Paspor</a>.</p>
        <p><b>Keamanan:</b> koneksi terenkripsi (HTTPS), kunci hash disimpan terpisah dari basis data, akses dashboard terbatas pada akun petugas yang ditunjuk.</p>
        <p><b>Kontak:</b> Pejabat Pelindungan Data Pribadi Disbudpar Provinsi Jawa Timur (kontak akan dicantumkan sebelum peluncuran).</p>
      </section>
    </main>
  );
}
