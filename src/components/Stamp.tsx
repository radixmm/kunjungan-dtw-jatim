// Stempel digital Jatim Pass. SVG murni: dipakai di halaman check-in, paspor, dan kartu bagikan.
// Bentuk stempel mengikuti kategori DTW: Alam = siluet gunung, Budaya = candi berundak,
// Buatan = bianglala, lainnya = segi enam. Tekstur tinta tipis agar terasa seperti cap karet.

type Layout = {
  ink: string;
  outline: string;                 // garis tepi luar (path)
  title: number; name: number; ribbon: number; kab: number; // posisi y tiap baris
  ribbonX: [number, number];       // lebar pita
  nameSize: number;
  extra?: (ink: string) => React.ReactNode;
};

const MOUNTAIN = "M 10 214 L 66 74 L 92 104 L 138 26 L 230 214 Z";
const CANDI = "M 10 216 V 196 H 22 V 174 H 38 V 112 H 64 V 88 H 84 V 66 H 102 V 46 L 120 20 L 138 46 V 66 H 156 V 88 H 176 V 112 H 202 V 174 H 218 V 196 H 230 V 216 Z";
const HEX = "M 120 14 L 214 66 V 174 L 120 226 L 26 174 V 66 Z";

const LAYOUTS: Record<string, Layout> = {
  Alam: {
    ink: "#1d6b52", outline: MOUNTAIN,
    title: 134, name: 158, ribbon: 184, kab: 204, ribbonX: [36, 204], nameSize: 13,
    extra: () => (
      <g stroke="none" fill="#fff">
        <path d="M 138 26 L 152 50 L 145 46 L 139 53 L 132 45 L 125 49 Z" />
        <path d="M 66 74 L 76 90 L 70 87 L 65 92 L 60 87 Z" />
      </g>
    ),
  },
  Budaya: {
    ink: "#8b2f5c", outline: CANDI,
    title: 132, name: 152, ribbon: 185, kab: 206, ribbonX: [30, 210], nameSize: 12.5,
    extra: (ink) => (
      <g stroke="none">
        <path d="M 112 106 V 94 A 8 8 0 0 1 128 94 V 106 Z" fill={ink} />
        <circle cx="120" cy="56" r="3.5" fill={ink} />
        <path d="M 54 166 H 186" stroke={ink} strokeWidth="1.2" strokeDasharray="2 3" fill="none" />
      </g>
    ),
  },
  Buatan: {
    ink: "#a3520c", outline: "",
    title: 66, name: 92, ribbon: 116, kab: 142, ribbonX: [40, 200], nameSize: 12.5,
    extra: (ink) => (
      <g>
        <path d="M 120 100 L 58 222 M 120 100 L 182 222 M 40 222 H 200" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <circle cx="120" cy="100" r="82" fill="#fff" stroke={ink} strokeWidth="5" />
        <circle cx="120" cy="100" r="70" fill="none" stroke={ink} strokeWidth="1.4" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const b = a + Math.PI / 12;
          return (
            <g key={i}>
              <rect x={120 + Math.cos(a) * 88 - 4.5} y={100 + Math.sin(a) * 88 - 4.5} width="9" height="9" rx="2" fill={ink} />
              <line x1={120 + Math.cos(b) * 70} y1={100 + Math.sin(b) * 70} x2={120 + Math.cos(b) * 82} y2={100 + Math.sin(b) * 82} stroke={ink} strokeWidth="1.2" />
            </g>
          );
        })}
      </g>
    ),
  },
  Lainnya: {
    ink: "#0d6b77", outline: HEX,
    title: 86, name: 112, ribbon: 138, kab: 166, ribbonX: [40, 200], nameSize: 13,
  },
};

export function Stamp({ nama, kab, tanggal, kode, kategori, size = 220 }: {
  nama: string; kab: string; tanggal: string; kode: string; kategori?: string; size?: number;
}) {
  const id = "st" + kode.replace(/\W/g, "");
  const L = LAYOUTS[kategori || ""] || LAYOUTS.Lainnya;
  const ink = L.ink;
  const [l1, l2] = splitName(nama);
  const kabLabel = kab.replace(/^Kab\.? /, "Kab. ").toUpperCase();
  const nameY = l2 ? L.name - 7 : L.name;
  const [rx1, rx2] = L.ribbonX;
  const display = "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif";
  const mono = "ui-monospace, 'SF Mono', Menlo, monospace";
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={`Stempel Jatim Pass ${nama}, ${tanggal}`}>
      <defs>
        {/* Tinta tidak rata: sedikit bergelombang dan berbintik, seperti cap karet. */}
        <filter id={id + "ink"} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="3" result="spots" />
          <feColorMatrix in="spots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.6" result="mask" />
          <feComposite in="d" in2="mask" operator="in" />
        </filter>
      </defs>
      <g transform="rotate(-5 120 120)" filter={`url(#${id}ink)`}>
        {L.outline && (
          <>
            {/* Garis tepi ganda yang mengikuti bentuk: goresan tebal berwarna tinta, lalu goresan putih di tengahnya. */}
            <path d={L.outline} fill="#fff" stroke={ink} strokeWidth="12" strokeLinejoin="round" />
            <path d={L.outline} fill="none" stroke="#fff" strokeWidth="4.5" strokeLinejoin="round" />
          </>
        )}
        {L.extra?.(ink)}

        <g fill={ink} stroke="none" textAnchor="middle">
          <text x="120" y={L.title} fontSize="13" fontWeight="800" letterSpacing="3.5" fontFamily={display}>JATIM PASS</text>
          <text x="120" y={nameY} fontSize={L.nameSize} fontWeight="800" fontFamily={display}>{l1}</text>
          {l2 && <text x="120" y={nameY + L.nameSize + 1} fontSize={L.nameSize} fontWeight="800" fontFamily={display}>{l2}</text>}
          <path d={`M ${rx1} ${L.ribbon - 9} H ${rx2} l -7 9 l 7 9 H ${rx1} l 7 -9 Z`} />
          <text x="120" y={L.ribbon + 4} fill="#fff" fontSize="11" fontWeight="700" letterSpacing="1.5" fontFamily={mono}>{tanggal.toUpperCase()}</text>
          <text x="120" y={L.kab} fontSize={kabLabel.length > 18 ? 8.5 : 9.5} fontWeight="700" letterSpacing="1.6" fontFamily="'Plus Jakarta Sans', sans-serif">{kabLabel}</text>
        </g>
      </g>
    </svg>
  );
}

/** Membagi nama DTW menjadi maksimal 2 baris ±16 karakter. */
export function splitName(nama: string): [string, string] {
  const clip = (t: string) => (t.length > 18 ? t.slice(0, 17) + "…" : t);
  if (nama.length <= 16) return [nama, ""];
  const w = nama.split(/\s+/);
  let a = "";
  while (w.length && (a + " " + w[0]).trim().length <= Math.max(16, Math.ceil(nama.length / 2))) a = (a + " " + w.shift()).trim();
  if (!a) a = w.shift() || "";
  return [clip(a), clip(w.join(" "))];
}
