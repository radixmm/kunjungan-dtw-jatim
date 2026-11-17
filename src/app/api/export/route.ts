import { getAdmin } from "@/lib/session";
import { q } from "@/lib/db";
import { DTW, PILOT, wilayahDtw } from "@/lib/ref";
import { BULAN_SHEET, wibMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

// Rekap bulanan dalam format sheet DATABASE:
// BULAN | BAKORWIL | KABUPATEN/KOTA | KATEGORI | KODE DTW | DTW | WISMAN | WISNUS | KET
export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("perlu login admin", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const bulan = /^\d{4}-\d{2}$/.test(sp.get("bulan") || "") ? sp.get("bulan")! : wibMonth();
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const mutu = sp.get("mutu") === "terverifikasi";

  const rows = await q<{ dtw_kode: string; wisnus: number; wisman: number; n: number; ok: number; demo: number }>(`
    SELECT dtw_kode, sum(CASE WHEN asal_tipe='wisnus' THEN pax ELSE 0 END)::int AS wisnus, sum(CASE WHEN asal_tipe='wisman' THEN pax ELSE 0 END)::int AS wisman,
           count(*)::int AS n, sum(CASE WHEN geo_status='ok' THEN 1 ELSE 0 END)::int AS ok, sum(CASE WHEN demo THEN 1 ELSE 0 END)::int AS demo
    FROM checkin WHERE to_char(visit_date, 'YYYY-MM') = $1 ${mutu ? "AND geo_status='ok' AND position('perjalanan_mustahil' in flags) = 0" : ""}
    GROUP BY dtw_kode`, [bulan]);
  const m = new Map(rows.map((r) => [r.dtw_kode, r]));
  const kodes = [...new Set([...PILOT.map((p) => p.kode), ...m.keys()])];
  const label = BULAN_SHEET[Number(bulan.slice(5)) - 1];
  const data = kodes.map((k) => {
    const d = DTW.get(k)!, r = m.get(k), w = wilayahDtw(d);
    const ket = ["scan QR" + (mutu ? " terverifikasi" : ""), r ? `${r.n} check-in, ${Math.round((r.ok / r.n) * 100)}% lokasi terverifikasi` : "belum ada check-in", r?.demo ? "DATA DEMO" : ""].filter(Boolean).join("; ");
    return [label, w.bakorwil, d.kab, d.kategori, k, d.nama, r?.wisman || 0, r?.wisnus || 0, ket] as (string | number)[];
  }).sort((a, b) => String(a[2]).localeCompare(String(b[2])) || String(a[5]).localeCompare(String(b[5])));
  const header = ["BULAN", "BAKORWIL", "KABUPATEN/KOTA", "KATEGORI", "KODE DTW", "DTW", "WISMAN", "WISNUS", "KET"];
  const name = `rekap-scan-qr-${bulan}`;

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
