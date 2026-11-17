// Stempel digital Jatim Pass. SVG murni: dipakai di halaman check-in, paspor, dan kartu bagikan.
// Warna dan ikon mengikuti kategori DTW (Alam / Budaya / Buatan); tekstur tinta tipis agar terasa seperti cap asli.

const THEME: Record<string, { ink: string; icon: string }> = {
  Alam: { ink: "#1d6b52", icon: "alam" },
  Budaya: { ink: "#8b2f5c", icon: "budaya" },
  Buatan: { ink: "#a3520c", icon: "buatan" },
};

export function Stamp({ nama, kab, tanggal, kode, kategori, size = 220 }: {
  nama: string; kab: string; tanggal: string; kode: string; kategori?: string; size?: number;
}) {
  const id = "st" + kode.replace(/\W/g, "");
  const th = THEME[kategori || ""] || { ink: "#0d6b77", icon: "lain" };
  const [l1, l2] = splitName(nama);
  const kabLabel = kab.replace(/^Kab\.? /, "Kab. ").toUpperCase();
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={`Stempel Jatim Pass ${nama}, ${tanggal}`}>
      <defs>
        <path id={id + "t"} d="M 40 120 A 80 80 0 0 1 200 120" />
        <path id={id + "b"} d="M 38 120 A 82 82 0 0 0 202 120" />
        {/* Tinta tidak rata: sedikit bergelombang dan berbintik, seperti cap karet. */}
        <filter id={id + "ink"} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="3" result="spots" />
          <feColorMatrix in="spots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.6" result="mask" />
          <feComposite in="d" in2="mask" operator="in" />
        </filter>
      </defs>
      <g transform="rotate(-7 120 120)" filter={`url(#${id}ink)`} fill={th.ink} stroke={th.ink}>
        {/* Cincin luar bergerigi + garis ganda */}
        <circle cx="120" cy="120" r="113" fill="none" strokeWidth="2" strokeDasharray="1.5 3.2" />
        <circle cx="120" cy="120" r="107" fill="none" strokeWidth="5" />
        <circle cx="120" cy="120" r="99" fill="none" strokeWidth="1.4" />
        <circle cx="120" cy="120" r="66" fill="none" strokeWidth="2.2" />

        <text stroke="none" fontSize="18" fontWeight="800" letterSpacing="3.5" fontFamily="'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif">
          <textPath href={`#${id}t`} startOffset="50%" textAnchor="middle">JATIM PASS</textPath>
        </text>
        <text stroke="none" fontSize={kabLabel.length > 20 ? 10 : 11.5} fontWeight="700" letterSpacing="2" fontFamily="'Plus Jakarta Sans', sans-serif">
          <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">{kabLabel}</textPath>
        </text>
        <Star x={27} y={120} />
        <Star x={213} y={120} />

        {/* Isi tengah: ikon kategori, nama DTW, pita tanggal */}
        <g transform="translate(120 80)" stroke="none"><Icon kind={th.icon} ink={th.ink} /></g>
        <text x="120" y={l2 ? 112 : 119} textAnchor="middle" stroke="none" fontSize="13.5" fontWeight="800" fontFamily="'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif">{l1}</text>
        {l2 && <text x="120" y="127" textAnchor="middle" stroke="none" fontSize="13.5" fontWeight="800" fontFamily="'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif">{l2}</text>}
        <path d="M 44 136 h 152 l -8 10 l 8 10 h -152 l 8 -10 z" stroke="none" />
        <text x="120" y="150.5" textAnchor="middle" stroke="none" fill="#fff" fontSize="11.5" fontWeight="700" letterSpacing="1.6" fontFamily="ui-monospace, 'SF Mono', Menlo, monospace">{tanggal.toUpperCase()}</text>
        <text x="120" y="172" textAnchor="middle" stroke="none" fontSize="8.5" fontWeight="600" letterSpacing="1.4" fontFamily="ui-monospace, Menlo, monospace" opacity=".85">{kode}</text>
      </g>
    </svg>
  );
}

function Star({ x, y }: { x: number; y: number }) {
  return <path transform={`translate(${x} ${y})`} stroke="none" d="M0 -6 L1.8 -1.9 L6 -1.9 L2.6 0.9 L3.8 5.2 L0 2.6 L-3.8 5.2 L-2.6 0.9 L-6 -1.9 L-1.8 -1.9 Z" />;
}

function Icon({ kind, ink }: { kind: string; ink: string }) {
  if (kind === "alam") // gunung + matahari
    return (<g><circle cx="9" cy="-9" r="4.5" /><path d="M-20 10 L-7 -8 L-1 0 L6 -11 L20 10 Z" /><path d="M-7 -8 L-4.5 -4.5 L-9.5 -4.5 Z M6 -11 L9.6 -5.6 L2.4 -5.6 Z" fill="#fff" /></g>);
  if (kind === "budaya") // candi bertingkat
    return (<g><rect x="-2" y="-15" width="4" height="4" /><rect x="-6" y="-11" width="12" height="5" /><rect x="-10" y="-6" width="20" height="5" /><rect x="-14" y="-1" width="28" height="6" /><rect x="-18" y="5" width="36" height="5" /><rect x="-3" y="1" width="6" height="9" fill="#fff" /></g>);
  if (kind === "buatan") // bianglala
    return (<g fill="none" strokeWidth="2.2" stroke={ink}><circle cx="0" cy="-3" r="11" /><path d="M0 -14 V8 M-11 -3 H11 M-7.8 -10.8 L7.8 4.8 M7.8 -10.8 L-7.8 4.8" strokeWidth="1.4" /><path d="M-7 12 L0 -3 L7 12" /></g>);
  return <path d="M0 -13 L3.8 -4 L13 -4 L5.6 1.8 L8.2 11 L0 5.6 L-8.2 11 L-5.6 1.8 L-13 -4 L-3.8 -4 Z" />;
}

/** Membagi nama DTW menjadi maksimal 2 baris ±15 karakter agar muat di lingkar dalam stempel. */
export function splitName(nama: string): [string, string] {
  const clip = (t: string) => (t.length > 16 ? t.slice(0, 15) + "…" : t);
  if (nama.length <= 15) return [nama, ""];
  const w = nama.split(/\s+/);
  let a = "";
  while (w.length && (a + " " + w[0]).trim().length <= Math.max(15, Math.ceil(nama.length / 2))) a = (a + " " + w.shift()).trim();
  if (!a) a = w.shift() || "";
  return [clip(a), clip(w.join(" "))];
}
