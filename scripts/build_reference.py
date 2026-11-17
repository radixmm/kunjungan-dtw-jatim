"""Bangun data referensi untuk aplikasi kunjungan.

Masukan:
  1. data.json Peta Wisata Jatim (https://peta-wisata-jatim.vercel.app/data.json),
     hasil kit/update_peta.py dari sheet "DATA BASE PROFIL DTW DAN DESA WISATA JAWA TIMUR".
  2. Paket npm idn-area-data (provinces.csv, regencies.csv) untuk daftar provinsi dan kab/kota.

Keluaran:
  data/dtw.json      1.549 DTW, ringkas, TANPA kontak pengelola (cp*).
  data/wilayah.json  38 provinsi dan 514 kab/kota.

Pemakaian:
  python3 -I scripts/build_reference.py <data.json> <folder idn-area-data/data>
"""
import csv, json, os, sys

KEEP = {
    "id": "id", "n": "nama", "k": "kab", "c": "kategori", "sc": "subkategori",
    "ds": "deskripsi", "kc": "kecamatan", "ds_": "desa", "jb": "buka", "jt": "tutup",
    "ll": "ll", "gm": "gmaps", "dpp": "dpp", "kspp": "kspp", "hl": "harga_min", "hh": "harga_max",
    "tk": "bertiket", "ms": "musala", "df": "disabilitas", "tl": "toilet", "v25": "v25", "v26": "v26",
}

def main(src, idn_dir, out_dir="data"):
    d = json.load(open(src, encoding="utf-8"))
    dtw = []
    for r in d["dtw"]:
        o = {}
        for k, v in KEEP.items():
            if r.get(k) not in (None, "", []):
                o[v] = r[k]
        if "deskripsi" in o and len(o["deskripsi"]) > 700:
            o["deskripsi"] = o["deskripsi"][:700].rsplit(" ", 1)[0] + "…"
        dtw.append(o)
    kab = {k: {"bakorwil": v.get("bk"), "bakorwil_nama": v.get("bkn"), "dpp": v.get("dpp")} for k, v in d["kab"].items()}
    meta = {"diperbarui": d["meta"].get("diperbarui"), "sumber": d["meta"].get("sumber_profil"),
            "dpp": d["meta"]["dpp"], "kspp": d["meta"]["kspp"]}
    json.dump({"meta": meta, "kab": kab, "dtw": dtw}, open(os.path.join(out_dir, "dtw.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    prov = [{"kode": r["code"], "nama": r["name"]} for r in csv.DictReader(open(os.path.join(idn_dir, "provinces.csv"), encoding="utf-8"))]
    kabs = {}
    for r in csv.DictReader(open(os.path.join(idn_dir, "regencies.csv"), encoding="utf-8")):
        nm = r["name"].replace("Kabupaten ", "Kab. ")
        kabs.setdefault(r["province_code"], []).append([r["code"], nm])
    for p in prov:
        p["kab"] = kabs.get(p["kode"], [])
    json.dump({"sumber": "idn-area-data 4.0.1 (kode wilayah Kemendagri)", "provinsi": prov},
              open(os.path.join(out_dir, "wilayah.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(dtw), "DTW;", len(prov), "provinsi;", sum(len(v) for v in kabs.values()), "kab/kota")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
