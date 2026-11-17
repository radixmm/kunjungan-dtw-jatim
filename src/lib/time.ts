// Semua tanggal kunjungan memakai zona Asia/Jakarta (WIB): seluruh DTW Jawa Timur berada di WIB.
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false });

export const wibDate = (d: Date = new Date()) => fmt.format(d); // YYYY-MM-DD
export const wibHour = (d: Date) => Number(hourFmt.format(d)) % 24;
export const wibMonth = (d: Date = new Date()) => wibDate(d).slice(0, 7);

export function addDays(date: string, n: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const BULAN_SHEET = ["01.JAN", "02.FEB", "03.MAR", "04.APR", "05.MEI", "06.JUN", "07.JUL", "08.AGT", "09.SEP", "10.OKT", "11.NOV", "12.DES"];
