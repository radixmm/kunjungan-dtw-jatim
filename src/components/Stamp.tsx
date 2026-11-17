// Stempel digital Paspor Wisata Jatim. SVG murni: dipakai di halaman, paspor, dan kartu bagikan.
export function Stamp({ nama, kab, tanggal, kode, size = 220 }: { nama: string; kab: string; tanggal: string; kode: string; size?: number }) {
  const id = "arc-" + kode.replace(/\W/g, "");
  const [l1, l2] = splitName(nama);
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} role="img" aria-label={`Stempel ${nama}, ${tanggal}`} style={{ color: "var(--stamp)" }}>
      <defs>
        <path id={id + "t"} d="M 30 110 A 80 80 0 0 1 190 110" />
        <path id={id + "b"} d="M 38 110 A 72 72 0 0 0 182 110" />
      </defs>
      <g fill="none" stroke="currentColor" opacity=".92" transform="rotate(-8 110 110)">
        <circle cx="110" cy="110" r="102" strokeWidth="4" />
        <circle cx="110" cy="110" r="94" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="58" strokeWidth="1.5" />
        <text fill="currentColor" stroke="none" fontSize="15" fontWeight="800" letterSpacing="2.5" fontFamily="var(--f-body)">
          <textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">PASPOR WISATA JATIM</textPath>
        </text>
        <text fill="currentColor" stroke="none" fontSize="12" fontWeight="700" letterSpacing="1.5" fontFamily="var(--f-body)">
          <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">{kab.toUpperCase()}</textPath>
        </text>
        <text x="110" y={l2 ? 100 : 108} textAnchor="middle" fill="currentColor" stroke="none" fontSize="11.5" fontWeight="700" fontFamily="var(--f-body)">{l1}</text>
        {l2 && <text x="110" y="114" textAnchor="middle" fill="currentColor" stroke="none" fontSize="11.5" fontWeight="700" fontFamily="var(--f-body)">{l2}</text>}
        <text x="110" y="132" textAnchor="middle" fill="currentColor" stroke="none" fontSize="10.5" fontWeight="600" fontFamily="ui-monospace, monospace">{tanggal}</text>
        <path d="M 22 110 l 6 -4 v 8 z M 198 110 l -6 -4 v 8 z" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

/** Membagi nama DTW menjadi maksimal 2 baris ±14 karakter agar muat di lingkar dalam stempel. */
export function splitName(nama: string): [string, string] {
  const clip = (t: string) => (t.length > 15 ? t.slice(0, 14) + "…" : t);
  if (nama.length <= 14) return [nama, ""];
  const w = nama.split(/\s+/);
  let a = "";
  while (w.length && (a + " " + w[0]).trim().length <= Math.max(14, Math.ceil(nama.length / 2))) a = (a + " " + w.shift()).trim();
  if (!a) a = w.shift() || "";
  return [clip(a), clip(w.join(" "))];
}
