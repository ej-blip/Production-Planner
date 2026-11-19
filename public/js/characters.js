// Production Planner — game characters and bench scenes, drawn in code.
// Shared by the Shift Planner (game.html) and the bench screens.
// Styles and animations: css/game.css.

// ------------------------------------------------------------------
// Characters: drawn in code, each worker's look picked from their name
// so it's the same every time.
// ------------------------------------------------------------------
const SKINS = ["#f9d7b9", "#f1c27d", "#e0ac69", "#c68642", "#9c6b3f", "#6b4226"];
const HAIR = ["#2b1d14", "#4a3122", "#6b3e1f", "#a0522d", "#d4a64a", "#111827", "#9ca3af"];
const SHIRTS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#0ea5e9"];
const PANTS = ["#334155", "#1e3a8a", "#3f3f46", "#4b5563", "#1f2937"];
const STYLES = ["short", "spiky", "long", "bun", "curly", "bald", "short", "long"];

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function lookFor(key) {
  const h = hash(key);
  return {
    skin: SKINS[h % SKINS.length],
    hair: HAIR[(h >>> 4) % HAIR.length],
    shirt: SHIRTS[(h >>> 8) % SHIRTS.length],
    pants: PANTS[(h >>> 12) % PANTS.length],
    style: STYLES[(h >>> 16) % STYLES.length]
  };
}

const S = 'stroke="#1e293b" stroke-width="2.4" stroke-linejoin="round"';
function hairSvg(style, colour) {
  const fill = `fill="${colour}" ${S}`;
  if (style === "bald") return "";
  if (style === "spiky") return `<path d="M13 24 L15 9 L20 15 L24 4 L29 12 L33 3 L37 12 L42 5 L44 15 L49 10 L51 24 Q44 15 32 15 Q20 15 13 24Z" ${fill}/>`;
  if (style === "bun") return `<circle cx="32" cy="4" r="6.5" ${fill}/><path d="M13.5 24 Q13 5 32 5 Q51 5 50.5 24 Q45 13 32 13 Q19 13 13.5 24Z" ${fill}/>`;
  if (style === "curly") return `<path d="M13 25 Q9 18 14 13 Q14 5 22 6 Q26 1 32 4 Q38 1 42 6 Q50 5 50 13 Q55 18 51 25 Q47 15 32 15 Q17 15 13 25Z" ${fill}/>`;
  if (style === "long") return `<path d="M13.5 24 Q13 5 32 5 Q51 5 50.5 24 Q45 13 32 13 Q19 13 13.5 24Z" ${fill}/>`;
  return `<path d="M13.5 23 Q13 5 32 5 Q51 5 50.5 23 Q46 12 32 12 Q18 12 13.5 23Z" ${fill}/>`;
}
function backHairSvg(style, colour) {
  return style === "long" ? `<path d="M13 22 L12 44 Q16 48 22 44 L22 30 M42 30 L42 44 Q48 48 52 44 L51 22 Z" fill="${colour}" ${S}/>` : "";
}
const TOOLS = {
  assembly: `<rect x="50.8" y="60" width="3.6" height="17" rx="1.5" fill="#92400e" ${S}/><rect x="44.5" y="56" width="16" height="7" rx="2" fill="#94a3b8" ${S}/>`,
  subAssembly: `<rect x="50.3" y="62" width="4.6" height="9" rx="2" fill="#ef4444" ${S}/><rect x="51.8" y="71" width="1.8" height="9" fill="#94a3b8" stroke="#1e293b" stroke-width="1.2"/>`,
  testing: `<rect x="44" y="58" width="17" height="13" rx="2.5" fill="#1e3a8a" ${S}/><rect class="lcd" x="46.5" y="60.5" width="12" height="8" rx="1" fill="#4ade80"/>`,
  hardware: `<line x1="54" y1="68" x2="58" y2="77" stroke="#475569" stroke-width="3.4" stroke-linecap="round"/><circle cx="52" cy="62" r="6.5" fill="#bae6fd" fill-opacity="0.75" ${S}/>`,
  packing: `<rect x="18" y="54" width="28" height="19" rx="2" fill="#d6a46b" ${S}/><line x1="32" y1="54" x2="32" y2="73" stroke="#a16207" stroke-width="3"/>`,
  final: `<circle cx="53" cy="70" r="5.5" fill="#fbbf24" ${S}/><circle cx="53" cy="70" r="2" fill="#fff"/>`
};

export function characterSvg(key, work) {
  const look = lookFor(key);
  const tool = work ? TOOLS[work] || "" : "";
  const box = work === "packing";
  return `
    <svg viewBox="0 0 64 98" aria-hidden="true">
      <ellipse cx="32" cy="93" rx="17" ry="4" fill="rgba(30,41,59,0.18)"/>
      <g class="leg leg-l"><rect x="22" y="66" width="9" height="22" rx="4" fill="${look.pants}" ${S}/><ellipse cx="25.5" cy="89" rx="7" ry="4" fill="#1e293b"/></g>
      <g class="leg leg-r"><rect x="33" y="66" width="9" height="22" rx="4" fill="${look.pants}" ${S}/><ellipse cx="38.5" cy="89" rx="7" ry="4" fill="#1e293b"/></g>
      <g class="arm arm-l"><rect x="7" y="44" width="9" height="22" rx="4.5" fill="${look.shirt}" ${S}/><circle cx="11.5" cy="67" r="4.6" fill="${look.skin}" ${S}/></g>
      <rect x="15" y="40" width="34" height="32" rx="12" fill="${look.shirt}" ${S}/>
      <rect x="35" y="47" width="8" height="5" rx="1.5" fill="#fff" opacity="0.85"/>
      ${box ? `<g class="tool">${tool}</g>` : ""}
      <g class="arm arm-r"><rect x="48" y="44" width="9" height="22" rx="4.5" fill="${look.shirt}" ${S}/><circle cx="52.5" cy="67" r="4.6" fill="${look.skin}" ${S}/>${box ? "" : `<g class="tool">${tool}</g>`}</g>
      <g class="head">
        ${backHairSvg(look.style, look.hair)}
        <circle cx="32" cy="24" r="18" fill="${look.skin}" ${S}/>
        ${hairSvg(look.style, look.hair)}
        <ellipse cx="25.5" cy="26" rx="2.6" ry="3.2" fill="#1e293b"/>
        <ellipse cx="38.5" cy="26" rx="2.6" ry="3.2" fill="#1e293b"/>
        <circle cx="20.5" cy="31.5" r="3" fill="#f472b6" opacity="0.35"/>
        <circle cx="43.5" cy="31.5" r="3" fill="#f472b6" opacity="0.35"/>
        <path class="mouth-smile" d="M26.5 33 Q32 38.5 37.5 33" fill="none" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse class="mouth-oh" cx="32" cy="35" rx="3.2" ry="3.8" fill="#1e293b"/>
      </g>
    </svg>`;
}

// ------------------------------------------------------------------
// Bench scenes
// ------------------------------------------------------------------
export function decorSvg(kind, count) {
  const v = 'viewBox="0 0 300 86" preserveAspectRatio="xMidYMax meet"';
  if (kind === "break") return `
    <svg class="room-decor" ${v}>
      <rect x="20" y="40" width="96" height="30" rx="10" fill="#f9a8d4" ${S}/><rect x="14" y="30" width="18" height="40" rx="8" fill="#f472b6" ${S}/><rect x="104" y="30" width="18" height="40" rx="8" fill="#f472b6" ${S}/>
      <rect x="196" y="22" width="34" height="48" rx="5" fill="#cbd5e1" ${S}/><rect x="204" y="30" width="18" height="10" rx="2" fill="#1e293b"/><rect x="207" y="50" width="12" height="12" rx="2" fill="#fff" ${S}/>
      <path class="steam" d="M213 44 q-3 -5 0 -9 q3 -4 0 -9" fill="none" stroke="#94a3b8" stroke-width="2"/>
      <rect x="252" y="48" width="20" height="22" rx="4" fill="#d97706" ${S}/><circle cx="262" cy="36" r="13" fill="#4ade80" ${S}/>
    </svg>`;
  if (kind === "cage") return `
    <svg class="room-decor" ${v}>
      <rect x="30" y="8" width="240" height="18" rx="6" fill="#14b8a6" ${S}/>
      <text x="150" y="21.5" text-anchor="middle" font-family="Fredoka, Trebuchet MS, sans-serif" font-weight="700" font-size="13" fill="#fff">MAGED'S MART</text>
      <path d="M40 26 h220 l-8 10 h-204 z" fill="#f43f5e" ${S}/>
      <rect x="44" y="40" width="70" height="30" rx="3" fill="#e2e8f0" ${S}/><rect x="186" y="40" width="70" height="30" rx="3" fill="#e2e8f0" ${S}/>
      <rect x="50" y="46" width="12" height="9" fill="#fbbf24" ${S}/><rect x="66" y="46" width="12" height="9" fill="#60a5fa" ${S}/><rect x="82" y="46" width="12" height="9" fill="#f472b6" ${S}/>
      <rect x="192" y="46" width="12" height="9" fill="#34d399" ${S}/><rect x="208" y="46" width="12" height="9" fill="#d6a46b" ${S}/><rect x="224" y="46" width="12" height="9" fill="#a78bfa" ${S}/>
      <rect x="122" y="52" width="56" height="18" rx="3" fill="#0f766e" ${S}/>
    </svg>`;
  if (kind === "testing") return `
    <svg class="room-decor" ${v}>
      <rect x="30" y="58" width="240" height="10" rx="3" fill="#94a3b8" ${S}/>
      <rect x="70" y="20" width="56" height="36" rx="4" fill="#1e293b" ${S}/><rect class="screen" x="76" y="26" width="44" height="24" rx="2"/>
      <rect x="174" y="20" width="56" height="36" rx="4" fill="#1e293b" ${S}/><rect class="screen b" x="180" y="26" width="44" height="24" rx="2"/>
    </svg>`;
  if (kind === "hardware") return `
    <svg class="room-decor" ${v}>
      <path class="beam" d="M220 18 L190 58 L250 58 Z" fill="#fde68a"/>
      <rect x="30" y="58" width="240" height="10" rx="3" fill="#a78bfa" ${S}/>
      <path d="M210 58 L210 30 L222 14" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/><path d="M212 10 L234 20 L226 26 Z" fill="#7c3aed" ${S}/>
      <rect x="60" y="46" width="22" height="12" rx="2" fill="#e2e8f0" ${S}/><rect x="92" y="46" width="22" height="12" rx="2" fill="#e2e8f0" ${S}/>
    </svg>`;
  if (kind === "packing" || kind === "final") {
    const boxes = Array.from({ length: 6 }, (_, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      return `<rect class="box ${i < Math.min(6, count * 2) ? "on" : ""}" x="${196 + col * 24}" y="${44 - row * 18}" width="22" height="17" rx="2" fill="${kind === "final" ? "#cbd5e1" : "#d6a46b"}" ${S}/>`;
    }).join("");
    return `
      <svg class="room-decor" ${v}>
        <rect x="186" y="62" width="84" height="8" rx="2" fill="#92400e" ${S}/>
        <g class="box-stack">${boxes}</g>
        <rect x="26" y="58" width="140" height="10" rx="3" fill="#6ee7b7" ${S}/>
        <circle cx="40" cy="74" r="5" fill="#475569" ${S}/><circle cx="150" cy="74" r="5" fill="#475569" ${S}/>
      </svg>`;
  }
  return `
    <svg class="room-decor" ${v}>
      <rect x="24" y="56" width="252" height="12" rx="3" fill="#b45309" ${S}/>
      <rect x="36" y="68" width="10" height="16" fill="#92400e" ${S}/><rect x="254" y="68" width="10" height="16" fill="#92400e" ${S}/>
      <rect x="60" y="44" width="30" height="12" rx="2" fill="#fde68a" ${S}/><rect x="210" y="40" width="22" height="16" rx="2" fill="#93c5fd" ${S}/>
      <path class="spark" d="M120 40 l5 -10 l2 8 l8 -4 l-5 9 l9 3 l-10 2 z" fill="#facc15" ${S}/>
      <path class="spark b" d="M180 36 l4 -8 l2 6 l7 -3 l-4 7 l7 2 l-8 2 z" fill="#facc15" ${S}/>
    </svg>`;
}

