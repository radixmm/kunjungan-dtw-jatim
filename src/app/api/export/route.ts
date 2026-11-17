import { getStaff } from "@/lib/staff";
import { q } from "@/lib/db";
import { DTW, PILOT, wilayahDtw, jalurOf, JALUR_LABEL } from "@/lib/ref";
import { syncScanRekap } from "@/lib/rekap";
import { BULAN_SHEET, wibMonth, addDays } from "@/lib/time";

export const dynamic = "force-dynamic";

// Rekap bulanan dalam format sheet DATABASE:
// BULAN | BAKORWIL | KABUPATEN/KOTA | KATEGORI | KODE DTW | DTW | WISMAN | WISNUS | KET
export async function GET(req: Request) {
  const st = await getStaff();
  if (!st?.isAdmin) return new Response("khusus admin provinsi", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const bulan = /^\d{4}-\d{2}$/.test(sp.get("bulan") || "") ? sp.get("bulan")! : wibMonth();
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const mutu = sp.get("mutu") === "terverifikasi";

  // Angka resmi = rekap harian DTW (petugas / scan / online). Pilihan "terverifikasi" hanya menjumlah hari yang sudah diverifikasi kab/kota.
  const from = bulan + "-01", to = addDays(addDays(from, 32).slice(0, 7) + "-01", -1);
  await syncScanRekap(from, to);
  const rows = await q<{ dtw_kode: string; wisnus: number; wisman: number; hari: number; ok: number }>(`
    SELECT dtw_kode, sum(CASE WHEN $2 OR status = 'terverifikasi' THEN wisnus ELSE 0 END)::int AS wisnus,
           sum(CASE WHEN $2 OR status = 'terverifikasi' THEN wisman ELSE 0 END)::int AS wisman,
           count(*)::int AS hari, sum(CASE WHEN status = 'terverifikasi' THEN 1 ELSE 0 END)::int AS ok
    FROM rekap_harian WHERE to_char(tanggal, 'YYYY-MM') = $1 GROUP BY dtw_kode`, [bulan, !mutu]);
  const demoRows = await q<{ n: number }>(`SELECT count(*)::int AS n FROM checkin WHERE demo AND to_char(visit_date, 'YYYY-MM') = $1`, [bulan]);
  const m = new Map(rows.map((r) => [r.dtw_kode, r]));
  const kodes = [...new Set([...PILOT.map((p) => p.kode), ...m.keys()])];
  const label = BULAN_SHEET[Number(bulan.slice(5)) - 1];
  const nHari = Number(to.slice(8));
  const data = kodes.map((k) => {
    const d = DTW.get(k)!, r = m.get(k), w = wilayahDtw(d);
    const ket = [JALUR_LABEL[jalurOf(k)], r ? `${r.hari}/${nHari} hari terisi, ${r.ok} terverifikasi` : "belum ada rekap", demoRows[0]?.n ? "ADA DATA DEMO" : ""].filter(Boolean).join("; ");
    return [label, w.bakorwil, d.kab, d.kategori, k, d.nama, r?.wisman || 0, r?.wisnus || 0, ket] as (string | number)[];
  }).sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[5]).localeCompare(String(b[5])));
  const header = ["BULAN", "BAKORWIL", "KABUPATEN/KOTA", "KATEGORI", "KODE DTW", "DTW", "WISMAN", "WISNUS", "KET"];
  const name = `rekap-kunjungan-dtw-${bulan}${mutu ? "-terverifikasi" : ""}`;

  if (format === "csv") {
    const esc = (v: string | number) => (typeof v === "number" ? String(v) : /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = "﻿" + [header, ...data].map((r) => r.map(esc).join(",")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DATABASE");
  ws.addRow(header).font = { bold: true };
  data.forEach((r) => ws.addRow(r));
  ws.columns = [10, 10, 22, 10, 13, 40, 10, 12, 48].map((width) => ({ width }));
  ws.getColumn(7).numFmt = "#,##0"; ws.getColumn(8).numFmt = "#,##0";
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
}
