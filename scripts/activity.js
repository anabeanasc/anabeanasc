// Gera a planilha estilo Excel da seção "ACTIVITY REPORT" a partir da atividade real no GitHub.
// Uso: GITHUB_TOKEN=... GH_USER=anabeanasc node scripts/activity.js
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GH_USER || 'anabeanasc';
const OUT = path.join(__dirname, '..', 'assets');

const BG = '#0d1117';
const PANEL = '#161b22';
const LINE = '#30363d';
const INK = '#e6edf3';
const MUTED = '#8b949e';
const NAVY = '#1e3a8a';
const SCALE = ['#172554', '#2e1065', '#5b21b6', '#8b5cf6', '#c4b5fd'];
const LAVENDER = '#c4b5fd';
const VIOLET = '#a78bfa';
const FONT = "ui-monospace,'SFMono-Regular','Cascadia Code',Consolas,'Liberation Mono',monospace";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function fetchData() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

function stats(user) {
  const cc = user.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

  // últimos 12 meses, incluindo o atual
  const now = new Date();
  const months = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear(), value: 0 });
  }
  const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
  for (const d of days) if (byKey[d.date.slice(0, 7)]) byKey[d.date.slice(0, 7)].value += d.contributionCount;

  return {
    total: cc.contributionCalendar.totalContributions,
    activeDays: days.filter((d) => d.contributionCount > 0).length,
    months,
    updated: now.toISOString().slice(0, 10),
  };
}

const shade = (v, max) => SCALE[max === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4))];

const STYLE = `<style>
    .t { font-family: ${FONT}; }
    @keyframes growx { from { transform: scaleX(0) } to { transform: scaleX(1) } }
    @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
    .fade { animation: fade .8s ease-out both; }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
  </style>`;

// ---------- Planilha estilo Excel ----------
function sheet(s) {
  const W = 900, rowH = 26, top = 92;
  const rows = s.months.length + 2; // cabeçalho + meses + total
  const H = top + 22 + rows * rowH + 46;
  const colX = [0, 46, 196, 316, 586, 736, W]; // nº da linha, A, B, C, D, E
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const max = Math.max(1, ...s.months.map((m) => m.value));
  const avg = s.total / 12;
  const totalRow = rows; // linha da planilha com o SUM
  const gy = top + 22;

  let cells = '';
  // letras das colunas
  letters.forEach((l, i) => {
    const sel = l === 'B';
    cells += `<rect x="${colX[i + 1]}" y="${top}" width="${colX[i + 2] - colX[i + 1]}" height="22" fill="${sel ? '#2e1065' : PANEL}" stroke="${LINE}"/>
      <text x="${(colX[i + 1] + colX[i + 2]) / 2}" y="${top + 15}" text-anchor="middle" fill="${sel ? LAVENDER : MUTED}" font-size="11">${l}</text>`;
  });
  cells += `<rect x="0" y="${top}" width="46" height="22" fill="${PANEL}" stroke="${LINE}"/>`;

  const header = ['Month', 'Contribs', 'Data bar', 'vs avg', 'Share'];
  for (let r = 0; r < rows; r++) {
    const y = gy + r * rowH;
    const n = r + 1;
    cells += `<rect x="0" y="${y}" width="46" height="${rowH}" fill="${n === totalRow ? '#2e1065' : PANEL}" stroke="${LINE}"/>
      <text x="23" y="${y + 17}" text-anchor="middle" fill="${n === totalRow ? LAVENDER : MUTED}" font-size="11">${n}</text>`;
    for (let c = 0; c < 5; c++) cells += `<rect x="${colX[c + 1]}" y="${y}" width="${colX[c + 2] - colX[c + 1]}" height="${rowH}" fill="${BG}" stroke="#21262d"/>`;

    if (r === 0) {
      header.forEach((h, c) => {
        cells += `<text x="${colX[c + 1] + 10}" y="${y + 17}" fill="${INK}" font-size="11" font-weight="700">${h}</text>`;
      });
      continue;
    }
    if (n === totalRow) {
      cells += `<text x="${colX[1] + 10}" y="${y + 17}" fill="${INK}" font-size="11" font-weight="700">Total</text>
        <rect x="${colX[2] + 1}" y="${y + 1}" width="${colX[3] - colX[2] - 2}" height="${rowH - 2}" fill="none" stroke="${LAVENDER}" stroke-width="2"/>
        <rect x="${colX[3] - 5}" y="${y + rowH - 5}" width="6" height="6" fill="${LAVENDER}"/>
        <text x="${colX[3] - 10}" y="${y + 17}" text-anchor="end" fill="${LAVENDER}" font-size="11" font-weight="700">${s.total}</text>
        <text x="${colX[4] + 10}" y="${y + 17}" fill="${MUTED}" font-size="11">avg ${avg.toFixed(1)}/month</text>
        <text x="${colX[6] - 10}" y="${y + 17}" text-anchor="end" fill="${INK}" font-size="11">100%</text>`;
      continue;
    }
    const m = s.months[r - 1];
    const diff = m.value - avg;
    const share = s.total ? (m.value / s.total) * 100 : 0;
    const barW = (m.value / max) * (colX[4] - colX[3] - 20);
    // escala de cor (formatação condicional) na coluna B
    cells += `<rect x="${colX[2] + 1}" y="${y + 1}" width="${colX[3] - colX[2] - 2}" height="${rowH - 2}" fill="#8b5cf6" opacity="${m.value ? (0.2 + 0.5 * (m.value / max)).toFixed(2) : 0}"/>
      <text x="${colX[1] + 10}" y="${y + 17}" fill="${INK}" font-size="11">${m.label} ${m.year}</text>
      <text x="${colX[3] - 10}" y="${y + 17}" text-anchor="end" fill="${m.value ? INK : MUTED}" font-size="11">${m.value}</text>
      ${m.value ? `<rect x="${colX[3] + 10}" y="${y + 6}" width="${barW.toFixed(1)}" height="${rowH - 12}" rx="2" fill="#8b5cf6" style="transform-origin:${colX[3] + 10}px 0;animation:growx .7s ease-out ${(0.2 + r * 0.05).toFixed(2)}s both"/>` : ''}
      <text x="${colX[4] + 10}" y="${y + 17}" fill="${diff > 0 ? LAVENDER : MUTED}" font-size="11">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}</text>
      <text x="${colX[6] - 10}" y="${y + 17}" text-anchor="end" fill="${m.value ? INK : MUTED}" font-size="11">${share.toFixed(0)}%</text>`;
  }

  const tabsY = gy + rows * rowH + 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spreadsheet of monthly contributions">
  ${STYLE}
  <rect width="${W}" height="${H}" rx="10" fill="${BG}" stroke="${LINE}"/>
  <g class="t">
    <rect x="1" y="1" width="${W - 2}" height="38" rx="10" fill="${PANEL}"/>
    <rect x="1" y="24" width="${W - 2}" height="15" fill="${PANEL}"/>
    <rect x="18" y="11" width="18" height="18" rx="3" fill="#5b21b6"/>
    <text x="27" y="24" text-anchor="middle" fill="${INK}" font-size="12" font-weight="700">X</text>
    <text x="46" y="25" fill="${INK}" font-size="13">activity.xlsx</text>
    <text x="${W - 18}" y="25" text-anchor="end" fill="${MUTED}" font-size="11">auto-refresh daily · ${s.updated}</text>
    <rect x="12" y="50" width="70" height="28" rx="4" fill="${BG}" stroke="${LINE}"/>
    <text x="47" y="69" text-anchor="middle" fill="${INK}" font-size="12">B${totalRow}</text>
    <text x="98" y="69" fill="${MUTED}" font-size="13" font-style="italic">fx</text>
    <rect x="122" y="50" width="${W - 134}" height="28" rx="4" fill="${BG}" stroke="${LINE}"/>
    <text x="136" y="69" fill="${INK}" font-size="12"><tspan fill="${VIOLET}">=SUM(</tspan>B2:B${totalRow - 1}<tspan fill="${VIOLET}">)</tspan></text>
    ${cells}
    <g font-size="11">
      <text x="18" y="${tabsY + 16}" fill="${MUTED}">◂ ▸</text>
      <rect x="56" y="${tabsY}" width="92" height="24" rx="4" fill="#2e1065"/>
      <text x="102" y="${tabsY + 16}" text-anchor="middle" fill="${LAVENDER}">contribs</text>
      <text x="166" y="${tabsY + 16}" fill="${MUTED}">dashboard</text>
      <text x="254" y="${tabsY + 16}" fill="${MUTED}">+</text>
    </g>
  </g>
</svg>`;
}

(async () => {
  const s = stats(await fetchData());
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'activity-sheet.svg'), sheet(s));
  console.log(`ok · ${s.total} contributions · ${s.activeDays} active days`);
})().catch((e) => { console.error(e); process.exit(1); });
