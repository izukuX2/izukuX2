// scripts/generate-svgs.js
// يجيب بياناتك الحقيقية من GitHub API ويولّد الـ SVGs

import fetch from 'node-fetch';

const USERNAME = process.env.GH_USERNAME || 'izukuX2';
const TOKEN    = process.env.GH_TOKEN;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type':  'application/json',
};

// ─── GraphQL query ────────────────────────────────────────────────
const query = `
query($login: String!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      nodes {
        name
        description
        primaryLanguage { name color }
        stargazerCount
        forkCount
        isArchived
        createdAt
        url
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
    followers { totalCount }
    following  { totalCount }
    repositoriesContributedTo(first: 1) { totalCount }
  }
}`;

async function fetchStats() {
  const res = await fetch('https://api.github.com/graphql', {
    method:  'POST',
    headers,
    body: JSON.stringify({ query, variables: { login: USERNAME } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

// ─── Language breakdown ───────────────────────────────────────────
function getLanguages(repos) {
  const count = {};
  for (const r of repos) {
    if (r.primaryLanguage) {
      count[r.primaryLanguage.name] = (count[r.primaryLanguage.name] || 0) + 1;
    }
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, n]) => ({ name, pct: Math.round((n / total) * 100) }));
}

// ─── Top pinned repos (by stars) ─────────────────────────────────
function getTopRepos(repos) {
  return repos
    .filter(r => !r.isArchived)
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, 3);
}

// ─── Contribution grid (last 10 weeks × 7 days) ──────────────────
function getGrid(calendar) {
  const days = calendar.weeks.flatMap(w => w.contributionDays);
  return days.slice(-70).map(d => d.contributionCount);
}

// ─── Color helper ─────────────────────────────────────────────────
function cellColor(count) {
  if (count === 0)  return { fill: '#1e1c18', opacity: 1 };
  if (count <= 2)   return { fill: '#b5000c', opacity: 0.3 };
  if (count <= 5)   return { fill: '#b5000c', opacity: 0.6 };
  if (count <= 10)  return { fill: '#c9a84c', opacity: 0.7 };
  return              { fill: '#c9a84c', opacity: 1.0 };
}

// ─── SVG helpers ─────────────────────────────────────────────────
const DEFS = (id1, id2, id3) => `
  <defs>
    <linearGradient id="${id1}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0b0f"/>
      <stop offset="100%" stop-color="#130a08"/>
    </linearGradient>
    <linearGradient id="${id2}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#0b0b0f" stop-opacity="0"/>
      <stop offset="30%"  stop-color="#c9a84c"/>
      <stop offset="60%"  stop-color="#b5000c"/>
      <stop offset="100%" stop-color="#0b0b0f" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id3}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#b5000c"/>
      <stop offset="100%" stop-color="#c9a84c"/>
    </linearGradient>
    <style>
      .mono { font-family: 'Courier New', Courier, monospace; }
    </style>
  </defs>`;

const FRAME = (bg, gl, w, h) => `
  <rect width="${w}" height="${h}" fill="url(#${bg})" rx="6"/>
  <rect width="${w}" height="${h}" fill="none" stroke="#c9a84c" stroke-width=".5" rx="6" opacity=".22"/>
  <rect x="0" y="0"   width="${w}" height="2" fill="url(#${gl})"/>
  <rect x="0" y="${h-2}" width="${w}" height="2" fill="url(#${gl})" opacity=".45"/>
  <g stroke="#b5000c" stroke-width="1.5" fill="none" opacity=".6">
    <path d="M14,26 L14,14 L26,14"/>
    <path d="M${w-14},26 L${w-14},14 L${w-26},14"/>
    <path d="M14,${h-26} L14,${h-14} L26,${h-14}"/>
    <path d="M${w-14},${h-26} L${w-14},${h-14} L${w-26},${h-14}"/>
  </g>`;

// ─── BANNER SVG ───────────────────────────────────────────────────
function makeBanner(stats) {
  const commits  = stats.contributionsCollection.totalCommitContributions;
  const prs      = stats.contributionsCollection.totalPullRequestContributions;
  const langs    = getLanguages(stats.repositories.nodes);
  const W = 860, H = 220;

  const barWidth = 175;
  const bars = langs.map((l, i) => {
    const bw = Math.round((l.pct / 100) * barWidth);
    const y  = 133 + i * 16;
    return `
    <text class="mono" x="156" y="${y + 6}" font-size="8" fill="#5a5450" letter-spacing=".8">${l.name.toUpperCase()}</text>
    <rect x="242" y="${y}" width="${barWidth}" height="3" rx="1.5" fill="#1e1c18"/>
    <rect x="242" y="${y}" width="${bw}" height="3" rx="1.5" fill="#b5000c" opacity=".9"/>
    <text class="mono" x="${242 + barWidth + 6}" y="${y + 6}" font-size="7" fill="#c9a84c" opacity=".5">${l.pct}%</text>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${DEFS('bg','gl','bar')}
  ${FRAME('bg','gl',W,H)}

  <text x="620" y="190" font-family="Georgia,serif" font-size="160" fill="#c9a84c" opacity=".08">実</text>

  <!-- Avatar box -->
  <rect x="28" y="28" width="102" height="164" rx="3" fill="#0e0c0a" stroke="#c9a84c" stroke-width=".7"/>
  <ellipse cx="79" cy="74" rx="21" ry="23" fill="#1c1814"/>
  <rect x="58" y="51" width="42" height="13" rx="3" fill="#141210"/>
  <rect x="67" y="72" width="8" height="2.5" rx="1" fill="#c9a84c" opacity=".7"/>
  <rect x="83" y="72" width="8" height="2.5" rx="1" fill="#c9a84c" opacity=".7"/>
  <path d="M50,107 L57,96 L79,102 L101,96 L108,107 L110,190 L48,190 Z" fill="#12100e" stroke="#c9a84c" stroke-width=".4" opacity=".9"/>
  <path d="M75,96 L79,102 L83,96 L81,116 L79,122 L77,116 Z" fill="#b5000c" opacity=".8"/>
  <rect x="34" y="180" width="90" height="10" rx="2" fill="#b5000c" opacity=".9"/>
  <text class="mono" x="79" y="188" font-size="7" fill="#f0ece0" text-anchor="middle" letter-spacing="2.5">CLASS-A</text>

  <!-- Name + role -->
  <text class="mono" x="154" y="74" font-size="34" font-weight="bold" fill="#c9a84c" letter-spacing="1.5">${USERNAME}</text>
  <text class="mono" x="156" y="94" font-size="9.5" fill="#b5000c" letter-spacing="2.5">FULL-STACK DEV  ·  STUDENT  ·  ALGERIA</text>
  <rect x="155" y="103" width="260" height=".5" fill="#c9a84c" opacity=".2"/>
  <text class="mono" x="156" y="118" font-size="10" fill="#908880">Building in silence. Code speaks for itself.</text>

  ${bars}

  <!-- Divider -->
  <rect x="444" y="34" width=".5" height="152" fill="#c9a84c" opacity=".15"/>

  <!-- Quote + stats -->
  <text x="460" y="68" font-family="Georgia,serif" font-size="30" fill="#b5000c" opacity=".3">"</text>
  <text class="mono" x="476" y="70"  font-size="10" fill="#a09888">The one who shouts his</text>
  <text class="mono" x="476" y="85"  font-size="10" fill="#a09888">capabilities hasn't used</text>
  <text class="mono" x="476" y="100" font-size="10" fill="#a09888">them yet.</text>
  <text class="mono" x="476" y="117" font-size="8.5" fill="#c9a84c" letter-spacing="1.5">— Ayanokoji Kiyotaka</text>
  <rect x="458" y="128" width="376" height=".5" fill="#c9a84c" opacity=".12"/>

  <rect x="460" y="138" width="110" height="46" rx="3" fill="#0e0c0a" stroke="#c9a84c" stroke-width=".4"/>
  <text x="515" y="161" font-family="Georgia,serif" font-size="20" fill="#c9a84c" text-anchor="middle">${commits}+</text>
  <text class="mono" x="515" y="177" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">COMMITS</text>

  <rect x="582" y="138" width="110" height="46" rx="3" fill="#0e0c0a" stroke="#c9a84c" stroke-width=".4"/>
  <text x="637" y="161" font-family="Georgia,serif" font-size="20" fill="#c9a84c" text-anchor="middle">${prs}+</text>
  <text class="mono" x="637" y="177" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">PULL REQ</text>

  <rect x="704" y="138" width="110" height="46" rx="3" fill="#0e0c0a" stroke="#b5000c" stroke-width=".6"/>
  <text x="759" y="161" font-family="Georgia,serif" font-size="22" fill="#b5000c" text-anchor="middle">S</text>
  <text class="mono" x="759" y="177" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">RANK</text>

  <circle cx="466" cy="202" r="3.5" fill="#b5000c"/>
  <text class="mono" x="476" y="206" font-size="8" fill="#5a5450" letter-spacing="1.5">ONLINE · DZ</text>
</svg>`;
}

// ─── PROJECTS SVG ─────────────────────────────────────────────────
function makeProjects(repos) {
  const top = getTopRepos(repos);
  const W = 860, H = 200;

  // language color map (fallback to gold)
  const langColor = { Kotlin: '#c9a84c', Dart: '#61dafb', JavaScript: '#f0db4f', Python: '#3572A5', 'default': '#c9a84c' };

  const cards = top.map((repo, i) => {
    const x        = 30 + i * 272;
    const isFeat   = i === 2;
    const stroke   = isFeat ? '#b5000c' : '#c9a84c';
    const sw       = isFeat ? '.6'      : '.4';
    const lColor   = langColor[repo.primaryLanguage?.name] || langColor.default;
    const desc     = (repo.description || 'No description').slice(0, 42);
    const descLine2 = desc.length > 36 ? desc.slice(36) : '';
    const descLine1 = desc.slice(0, 36);
    const lang     = repo.primaryLanguage?.name || 'Unknown';

    return `
  <rect x="${x}" y="50" width="256" height="112" rx="3" fill="#0e0c0a" stroke="${stroke}" stroke-width="${sw}" opacity=".9"/>
  <rect x="${x}" y="50" width="256" height="1.5" rx="1" fill="#b5000c" opacity="${isFeat ? '.9' : '.7'}"/>
  ${isFeat ? `<rect x="${x+108}" y="56" width="56" height="13" rx="2" fill="#b5000c" opacity=".85"/>
  <text class="mono" x="${x+136}" y="65.5" font-size="7" fill="#f0ece0" text-anchor="middle" letter-spacing="1.5">FEATURED</text>` : ''}
  <text class="mono" x="${x+14}" y="74" font-size="12" fill="#f0ece0" letter-spacing=".5" font-weight="bold">${repo.name}</text>
  <text class="mono" x="${x+14}" y="90"  font-size="9" fill="#908880">${descLine1}</text>
  ${descLine2 ? `<text class="mono" x="${x+14}" y="102" font-size="9" fill="#908880">${descLine2}</text>` : ''}
  <rect x="${x+14}" y="112" width="228" height=".5" fill="#c9a84c" opacity=".12"/>
  <circle cx="${x+20}" cy="126" r="4" fill="${lColor}"/>
  <text class="mono" x="${x+29}" y="129" font-size="8.5" fill="#908880" letter-spacing=".5">${lang}</text>
  <text class="mono" x="${x+150}" y="129" font-size="9" fill="#c9a84c">★</text>
  <text class="mono" x="${x+161}" y="129" font-size="8.5" fill="#5a5450">${repo.stargazerCount}</text>
  <text class="mono" x="${x+185}" y="129" font-size="8.5" fill="#5a5450">⑂</text>
  <text class="mono" x="${x+197}" y="129" font-size="8.5" fill="#5a5450">${repo.forkCount}</text>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${DEFS('bgp','glp','barp')}
  ${FRAME('bgp','glp',W,H)}
  <text class="mono" x="30" y="34" font-size="8" fill="#5a5450" letter-spacing="3">// PINNED PROJECTS</text>
  <rect x="30" y="40" width="800" height=".5" fill="#c9a84c" opacity=".12"/>
  ${cards}
  <text class="mono" x="430" y="178" font-size="8" fill="#3a3430" text-anchor="middle" letter-spacing="2">github.com/${USERNAME}</text>
</svg>`;
}

// ─── STATS SVG ────────────────────────────────────────────────────
function makeStats(stats) {
  const commits  = stats.contributionsCollection.totalCommitContributions;
  const prs      = stats.contributionsCollection.totalPullRequestContributions;
  const stars    = stats.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  const repos    = stats.repositories.nodes.length;
  const langs    = getLanguages(stats.repositories.nodes);
  const grid     = getGrid(stats.contributionsCollection.contributionCalendar);
  const W = 860, H = 220;

  const barWidth = 200;
  const langBars = langs.map((l, i) => {
    const bw = Math.round((l.pct / 100) * barWidth);
    const y  = 85 + i * 18;
    return `
    <text class="mono" x="563" y="${y + 6}" font-size="8" fill="#c9a84c" letter-spacing=".5">${l.name}</text>
    <rect x="620" y="${y}" width="${barWidth}" height="3" rx="1.5" fill="#1e1c18"/>
    <rect x="620" y="${y}" width="${bw}" height="3" rx="1.5" fill="#b5000c" opacity=".9"/>
    <text class="mono" x="${620 + barWidth + 6}" y="${y + 6}" font-size="7" fill="#c9a84c" opacity=".45">${l.pct}%</text>`;
  }).join('');

  // grid cells: 70 days, 10 per row
  const cells = grid.map((count, idx) => {
    const col   = idx % 50;
    const row   = Math.floor(idx / 50);
    const x     = 30 + col * 10;
    const y     = 160 + row * 12;
    const { fill, opacity } = cellColor(count);
    return `<rect x="${x}" y="${y}" width="8" height="8" rx="1" fill="${fill}" opacity="${opacity}"/>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${DEFS('bgs','gls','bars')}
  ${FRAME('bgs','gls',W,H)}

  <text class="mono" x="30" y="34" font-size="8" fill="#5a5450" letter-spacing="3">// GITHUB STATS</text>
  <rect x="30" y="40" width="800" height=".5" fill="#c9a84c" opacity=".12"/>

  <!-- Stat cards -->
  <rect x="30"  y="52" width="115" height="70" rx="3" fill="#0e0c0a" stroke="#c9a84c" stroke-width=".4"/>
  <rect x="30"  y="52" width="115" height="1.5" rx="1" fill="#b5000c" opacity=".7"/>
  <text x="87"  y="82" font-family="Georgia,serif" font-size="20" fill="#c9a84c" text-anchor="middle">${commits}</text>
  <text class="mono" x="87"  y="110" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">COMMITS</text>

  <rect x="157" y="52" width="115" height="70" rx="3" fill="#0e0c0a" stroke="#c9a84c" stroke-width=".4"/>
  <rect x="157" y="52" width="115" height="1.5" rx="1" fill="#b5000c" opacity=".7"/>
  <text x="214" y="82" font-family="Georgia,serif" font-size="20" fill="#c9a84c" text-anchor="middle">${repos}</text>
  <text class="mono" x="214" y="110" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">REPOS</text>

  <rect x="284" y="52" width="115" height="70" rx="3" fill="#0e0c0a" stroke="#c9a84c" stroke-width=".4"/>
  <rect x="284" y="52" width="115" height="1.5" rx="1" fill="#b5000c" opacity=".7"/>
  <text x="341" y="82" font-family="Georgia,serif" font-size="20" fill="#c9a84c" text-anchor="middle">${stars}</text>
  <text class="mono" x="341" y="110" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">★ STARS</text>

  <rect x="411" y="52" width="115" height="70" rx="3" fill="#0e0c0a" stroke="#b5000c" stroke-width=".6"/>
  <rect x="411" y="52" width="115" height="1.5" rx="1" fill="#b5000c" opacity=".9"/>
  <text x="468" y="82" font-family="Georgia,serif" font-size="20" fill="#b5000c" text-anchor="middle">${prs}</text>
  <text class="mono" x="468" y="110" font-size="7" fill="#5a5450" text-anchor="middle" letter-spacing="1.5">PULL REQ</text>

  <!-- Divider -->
  <rect x="548" y="46" width=".5" height="148" fill="#c9a84c" opacity=".15"/>

  <!-- Language bars -->
  <text class="mono" x="563" y="66" font-size="7.5" fill="#5a5450" letter-spacing="2">TOP LANGUAGES</text>
  <rect x="563" y="72" width="267" height=".5" fill="#c9a84c" opacity=".1"/>
  ${langBars}

  <!-- Contribution grid -->
  <text class="mono" x="30" y="148" font-size="7.5" fill="#5a5450" letter-spacing="2">CONTRIBUTION ACTIVITY</text>
  ${cells}
</svg>`;
}

// ─── TIMELINE SVG ─────────────────────────────────────────────────
function makeTimeline(stats) {
  const commits = stats.contributionsCollection.totalCommitContributions;
  const W = 860, H = 260;

  // حساب سنة البداية من أقدم ريبو
  const repoYears = stats.repositories.nodes
    .map(r => r.createdAt ? new Date(r.createdAt).getFullYear() : 9999)
    .filter(y => y < 9999);
  const startYear = repoYears.length ? Math.min(...repoYears) : 2022;
  const currentYear = new Date().getFullYear();

  // توليد النودات ديناميكياً حسب عدد السنين
  const years = [];
  for (let y = startYear; y <= currentYear; y++) years.push(y);

  const nodeCount = Math.min(years.length, 5);
  const nodes     = years.slice(0, nodeCount);
  const spacing   = 770 / (nodeCount + 1);

  const nodeLabels = [
    { title: 'Started Coding', sub: 'HTML · CSS · JS' },
    { title: 'Android Dev',    sub: 'Kotlin · Jetpack' },
    { title: '1st OSS Project',sub: `zatsu · AnimeHat` },
    { title: 'Full-Stack Jump', sub: 'React · Node · Python' },
    { title: 'S-Rank Journey',  sub: `${commits}+ commits` },
  ];

  const nodesSVG = nodes.map((year, i) => {
    const cx      = Math.round(50 + spacing * (i + 1));
    const isLast  = i === nodes.length - 1;
    const above   = i % 2 === 0;
    const label   = nodeLabels[i] || { title: String(year), sub: '' };
    const cardY   = above ? 60  : 160;
    const lineY1  = above ? 133 : 143;
    const lineY2  = above ? cardY + 56 : cardY;

    return `
  <circle cx="${cx}" cy="138" r="5" fill="${isLast ? '#c9a84c' : '#b5000c'}" opacity="${isLast ? '1' : '.85'}"/>
  <line x1="${cx}" y1="${lineY1}" x2="${cx}" y2="${lineY2}" stroke="#b5000c" stroke-width=".6" stroke-dasharray="3 2" opacity=".5"/>
  <rect x="${cx - 55}" y="${cardY}" width="110" height="56" rx="3" fill="#0e0c0a"
    stroke="${isLast ? '#b5000c' : '#c9a84c'}" stroke-width="${isLast ? '.7' : '.4'}" opacity=".95"/>
  <rect x="${cx - 55}" y="${cardY}" width="110" height="1.5" rx="1" fill="#b5000c" opacity="${isLast ? '.9' : '.65'}"/>
  ${isLast ? `<rect x="${cx - 20}" y="${cardY + 4}" width="40" height="11" rx="2" fill="#b5000c" opacity=".85"/>
  <text font-family="Courier New,monospace" x="${cx}" y="${cardY + 12}" font-size="6.5" fill="#f0ece0" text-anchor="middle" letter-spacing="1.5">NOW</text>` : ''}
  <text font-family="Courier New,monospace" x="${cx}" y="${cardY + (isLast ? 30 : 22)}" font-size="8" fill="#c9a84c" text-anchor="middle" letter-spacing=".5">${year}</text>
  <text font-family="Courier New,monospace" x="${cx}" y="${cardY + (isLast ? 43 : 35)}" font-size="7.5" fill="#f0ece0" text-anchor="middle">${label.title}</text>
  <text font-family="Courier New,monospace" x="${cx}" y="${cardY + (isLast ? 54 : 47)}" font-size="7" fill="#5a5450" text-anchor="middle">${label.sub}</text>
  <text font-family="Courier New,monospace" x="${cx}" y="158" font-size="7" fill="${isLast ? '#c9a84c' : '#3a3430'}" text-anchor="middle" opacity="${isLast ? '.5' : '1'}">${year}</text>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${DEFS('bgtl','gltl','bartl')}
  ${FRAME('bgtl','gltl',W,H)}

  <text x="700" y="230" font-family="Georgia,serif" font-size="140" fill="#c9a84c" opacity=".07">道</text>

  <text font-family="Courier New,monospace" x="30" y="34" font-size="8" fill="#5a5450" letter-spacing="3">// JOURNEY / TIMELINE</text>
  <rect x="30" y="40" width="800" height=".5" fill="#c9a84c" opacity=".12"/>

  <rect x="50" y="138" width="770" height="1.5" rx="1" fill="#b5000c" opacity=".4"/>

  ${nodesSVG}

  <text font-family="Courier New,monospace" x="430" y="238" font-size="7.5" fill="#3a3430" text-anchor="middle" letter-spacing="2">github.com/${USERNAME}  ·  BUILDING IN SILENCE</text>
</svg>`;
}

// ─── SOCIAL SVG ───────────────────────────────────────────────────
function makeSocial(stats) {
  const followers = stats.followers.totalCount;
  const following = stats.following.totalCount;
  const W = 860, H = 200;

  // بيانات التواصل — عدّل الـ handles حسب حساباتك
  const contacts = [
    { label: 'GitHub',   handle: 'izukuX2',         color: '#c9a84c', icon: 'GH' },
    { label: 'Telegram', handle: '@attoui_ishak',   color: '#3b83c8', icon: 'TG' },
    { label: 'Discord',  handle: 'izuku_ffx',    color: '#5865f2', icon: 'DC' },
    { label: 'Email',    handle: 'attouiishak14@gmail.com', color: '#c9a84c', icon: 'EM' },
    { label: 'Location', handle: 'Algeria · DZ',   color: '#b5000c', icon: 'DZ' },
  ];

  const cardW = 148;
  const cards = contacts.map((c, i) => {
    const x       = 30 + i * (cardW + 14);
    const isFeat  = i === 4;
    const stroke  = isFeat ? '#b5000c' : '#c9a84c';
    const sw      = isFeat ? '.6' : '.4';
    return `
  <rect x="${x}" y="52" width="${cardW}" height="110" rx="3" fill="#0e0c0a" stroke="${stroke}" stroke-width="${sw}"/>
  <rect x="${x}" y="52" width="${cardW}" height="1.5" rx="1" fill="#b5000c" opacity="${isFeat ? '.9' : '.7'}"/>
  <circle cx="${x + cardW/2}" cy="92" r="16" fill="#1c1814" stroke="${c.color}" stroke-width=".6"/>
  <text font-family="Courier New,monospace" x="${x + cardW/2}" y="97" font-size="9" fill="${c.color}" text-anchor="middle" font-weight="bold">${c.icon}</text>
  <text font-family="Courier New,monospace" x="${x + cardW/2}" y="121" font-size="8" fill="#f0ece0" text-anchor="middle" letter-spacing=".5">${c.label}</text>
  <text font-family="Courier New,monospace" x="${x + cardW/2}" y="133" font-size="7" fill="${c.color}" text-anchor="middle" letter-spacing=".3">${c.handle.slice(0, 20)}</text>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${DEFS('bgsc','glsc','barsc')}
  ${FRAME('bgsc','glsc',W,H)}

  <text font-family="Courier New,monospace" x="30" y="34" font-size="8" fill="#5a5450" letter-spacing="3">// CONTACT &amp; SOCIAL</text>
  <rect x="30" y="40" width="800" height=".5" fill="#c9a84c" opacity=".12"/>

  ${cards}

  <circle cx="30" cy="172" r="3.5" fill="#b5000c"/>
  <text font-family="Courier New,monospace" x="40" y="176" font-size="8" fill="#5a5450" letter-spacing="1.5">ONLINE · DZ</text>
  <text font-family="Courier New,monospace" x="830" y="176" font-size="8" fill="#5a5450" text-anchor="end" letter-spacing="1">${followers} followers · ${following} following</text>
</svg>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────
import { writeFileSync } from 'fs';

console.log(`Fetching stats for @${USERNAME}...`);
const data = await fetchStats();

writeFileSync('banner.svg',   makeBanner(data));
writeFileSync('projects.svg', makeProjects(data.repositories.nodes));
writeFileSync('stats.svg',    makeStats(data));
writeFileSync('timeline.svg', makeTimeline(data));
writeFileSync('social.svg',   makeSocial(data));

console.log('✅  SVGs generated: banner.svg  projects.svg  stats.svg  timeline.svg  social.svg');
