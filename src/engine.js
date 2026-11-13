// Payroster engine: roster parser + pay rules (Convenio TCP Eurowings Europe, bases España)
// Pure functions; no DOM. Used by the page and by node tests.
var PR = (function () {
  const PARSER_V = 10; // bump when the roster reader changes, so saved months get re-read
  const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const ES_AIRPORTS = new Set(('PMI IBZ MAH MAD BCN AGP ALC VLC SVQ BIO SCQ VGO OVD SDR LPA TFS TFN ACE FUE SPC GMZ VDE ' +
    'GRX XRY LEI REU GRO ZAZ VIT PNA LCG MJV RMU VLL SLM LEN BJZ EAS SDR HSK ODB RGS CDT MLN JCU').split(' '));

  // ---------- time zones (IDP prints every time in UTC) ----------
  const TZ = {};
  const tzList = {
    'Europe/London': 'LHR LGW STN LTN MAN EDI GLA BHX BRS NCL LPL BFS EMA ABZ',
    'Europe/Dublin': 'DUB ORK SNN',
    'Europe/Lisbon': 'LIS OPO FAO FNC PDL',
    'Atlantic/Canary': 'LPA TFS TFN ACE FUE SPC VDE GMZ',
    'Europe/Athens': 'ATH HER RHO CFU SKG KGS JTR JMK CHQ ZTH KLX EFL PVK',
    'Asia/Nicosia': 'LCA PFO', 'Europe/Helsinki': 'HEL', 'Europe/Riga': 'RIX', 'Europe/Vilnius': 'VNO', 'Europe/Tallinn': 'TLL',
    'Europe/Bucharest': 'OTP', 'Europe/Sofia': 'SOF VAR BOJ', 'Europe/Kiev': 'KBP',
    'Europe/Istanbul': 'IST SAW AYT ADB DLM BJV ESB', 'Africa/Casablanca': 'RAK AGA CMN TNG FEZ',
    'Africa/Cairo': 'HRG SSH CAI RMF', 'Asia/Jerusalem': 'TLV', 'Asia/Dubai': 'DXB', 'Atlantic/Reykjavik': 'KEF'
  };
  for (const z in tzList) tzList[z].split(' ').forEach(a => TZ[a] = z);
  const tzOf = st => TZ[st] || (typeof AIRPORT_TZ !== 'undefined' && AIRPORT_TZ[st]) || 'Europe/Madrid'; // the rest of Europe shares CET/CEST
  function localHour(dateISO, hhmm, st) {
    const [y, m, d] = dateISO.split('-').map(Number);
    const utc = Date.UTC(y, m - 1, d, Math.floor(+hhmm / 100), +hhmm % 100);
    try {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: tzOf(st), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utc));
      return +p.find(x => x.type === 'hour').value + (+p.find(x => x.type === 'minute').value) / 60;
    } catch (e) { return Math.floor(+hhmm / 100) + 1; }
  }

  // ---------- EASA ORO.FTL.205 (b)(1): max daily FDP, acclimatised crew ----------
  // rows: [from, to) local start time in minutes; values for 1–2, 3, 4 … 10 sectors (minutes)
  const FDP_TABLE = (() => {
    const h = x => { const [a, b] = x.split(':').map(Number); return a * 60 + b; };
    const row = (from, to, list) => ({ from: h(from), to: h(to), v: list.split(' ').map(h) });
    return [
      row('06:00', '13:30', '13:00 12:30 12:00 11:30 11:00 10:30 10:00 9:30 9:00'),
      row('13:30', '14:00', '12:45 12:15 11:45 11:15 10:45 10:15 9:45 9:15 9:00'),
      row('14:00', '14:30', '12:30 12:00 11:30 11:00 10:30 10:00 9:30 9:00 9:00'),
      row('14:30', '15:00', '12:15 11:45 11:15 10:45 10:15 9:45 9:15 9:00 9:00'),
      row('15:00', '15:30', '12:00 11:30 11:00 10:30 10:00 9:30 9:00 9:00 9:00'),
      row('15:30', '16:00', '11:45 11:15 10:45 10:15 9:45 9:15 9:00 9:00 9:00'),
      row('16:00', '16:30', '11:30 11:00 10:30 10:00 9:30 9:00 9:00 9:00 9:00'),
      row('16:30', '17:00', '11:15 10:45 10:15 9:45 9:15 9:00 9:00 9:00 9:00'),
      row('05:00', '05:15', '12:00 11:30 11:00 10:30 10:00 9:30 9:00 9:00 9:00'),
      row('05:15', '05:30', '12:15 11:45 11:15 10:45 10:15 9:45 9:15 9:00 9:00'),
      row('05:30', '05:45', '12:30 12:00 11:30 11:00 10:30 10:00 9:30 9:00 9:00'),
      row('05:45', '06:00', '12:45 12:15 11:45 11:15 10:45 10:15 9:45 9:15 9:00')
    ];
  })();
  const FDP_NIGHT = '11:00 10:30 10:00 9:30 9:00 9:00 9:00 9:00 9:00'.split(' ').map(x => { const [a, b] = x.split(':').map(Number); return a * 60 + b; }); // 17:00–04:59
  function maxFdp(startLocalH, sectors) {
    const m = Math.round(((startLocalH % 24) + 24) % 24 * 60);
    const r = FDP_TABLE.find(x => m >= x.from && m < x.to);
    const col = Math.min(8, Math.max(0, (sectors || 1) - 2));
    return (r ? r.v : FDP_NIGHT)[col] / 60;
  }

  // ---------- convenio tables ----------
  const BASE = {
    PU: [null, 2150, 2175, 2200, 2225, 2250, 2275, 2300, 2325, 2350, 2375, 2400, 2425, 2450, 2475, 2500],
    CA: [1260, 1740, 1781, 1822, 1863, 1904, 1945, 1986, 2027, 2068, 2109, 2150]
  };
  // new CLA (STAVLA final proposal, PMI): salary tables from 01.01.2027 and 01.01.2028.
  // Hourly rates are a % of the monthly base, so they rise with the tables too.
  const BASE_Y = {
    2027: { PU: [null, 2381.66, 2409.36, 2437.05, 2464.75, 2492.44, 2520.14, 2547.83, 2575.52, 2603.21, 2630.91, 2658.60, 2686.30, 2713.99, 2741.69, 2769.38],
            CA: [1395.77, 1927.49, 1972.91, 2018.32, 2063.74, 2109.16, 2154.58, 2199.99, 2245.41, 2290.83, 2336.25, 2381.66] },
    2028: { PU: [null, 2488.83, 2517.78, 2546.72, 2575.66, 2604.60, 2633.55, 2662.48, 2691.42, 2720.35, 2749.30, 2778.24, 2807.18, 2836.12, 2865.07, 2894.00],
            CA: [1458.58, 2014.23, 2061.69, 2109.14, 2156.61, 2204.07, 2251.54, 2298.99, 2346.45, 2393.92, 2441.38, 2488.83] }
  };
  const newCla = s => !s || s.cla27 !== false;
  function baseTab(rank, year, s) {
    if (newCla(s) && year >= 2028) return BASE_Y[2028][rank];
    if (newCla(s) && year >= 2027) return BASE_Y[2027][rank];
    return BASE[rank];
  }
  const PCT = { // % of monthly base per hour, art. 24.7.2
    PU: { fdp: [0.105, 0.2, 0.32], add: [0.053, 0.1, 0.16] },
    CA: { fdp: [0.065, 0.2, 0.33], add: [0.033, 0.1, 0.165] }
  };
  const TIER_LIMITS = { // art. 30.7.7.2, by contract %
    100: [70, 110], 95: [67, 105], 90: [63, 99], 85: [60, 94], 80: [56, 88], 75: [53, 83], 70: [49, 77], 65: [46, 72], 60: [42, 66], 55: [39, 61], 50: [35, 55]
  };
  const DIETA = { intlDay: 66.11, natDay: 36.06, intlNight: 91.35, natNight: 53.34 };
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

  function defaultSettings() {
    return {
      rank: 'PU', level: 1, levelMode: 'date', since: '', contract: 100, base: 'PMI',
      isTrainer: false, isCT: false, uniform: 66.66, irpf: 15, ss: 6.5, configured: false,
      salesEstimate: 0, minDietas: false,
      absenceCodes: 'U, SU, UL, URL, VAC, SICK, KRANK, PERM, PR',
      earlyCheckin: 30,
      trainingCodes: 'DT_TRNG, CATR, CAB_K', joined: '', fiscalAid: 500, ctCodes: 'COMP',
      // Works Agreement Cabin Trainers (Eurowings Europe Spain), 1.1.1.2
      tBase: 270, tTwo: 340, tExtra: 105, ctBase: 80, ctExtra: 80
    };
  }

  function rates(s, year) {
    const base = baseTab(s.rank, year || 2026, s)[s.level] || 0;
    const p = PCT[s.rank];
    return {
      base,
      fdp: p.fdp.map(x => r2(base * x / 100)),
      add: p.add.map(x => r2(base * x / 100)),
      limits: [70, 110]   // payslips of part-time crew (80 %) use the same 70 / 110 h tiers
    };
  }
  function interpLimits(c) {
    const keys = Object.keys(TIER_LIMITS).map(Number).sort((a, b) => a - b);
    let lo = keys[0], hi = keys[keys.length - 1];
    for (const k of keys) { if (k <= c) lo = k; if (k >= c && hi > k) hi = k; }
    if (lo === hi) return TIER_LIMITS[lo];
    const f = (c - lo) / (hi - lo);
    return [0, 1].map(i => Math.round(TIER_LIMITS[lo][i] + f * (TIER_LIMITS[hi][i] - TIER_LIMITS[lo][i])));
  }

  // ---------- helpers ----------
  const hm = s => { const m = /^(\d{1,3}):(\d{2})/.exec(s || ''); return m ? (+m[1]) + (+m[2]) / 60 : 0; };
  const isTime = s => /^\d{4}$/.test(s);
  const isStation = s => /^[A-Z]{3}$/.test(s);
  const dateRe = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{2})$/;

  // ---------- parser ----------
  // pages: [{items:[{x,y,str}]}] in page orientation (y grows downward)
  // An IDP export can cover one month or several (e.g. 01Jan26 - 30Nov26): parseRosterAll returns one roster per month.
  function parseRoster(pages, ym) {
    const all = parseRosterAll(pages);
    return (ym && all.find(r => r.year + '-' + String(r.month).padStart(2, '0') === ym)) || all[0];
  }
  function parseRosterAll(pages) {
    const raw = pages.flatMap((p, i) => p.items.map(it => ({ ...it, page: i })));
    // The duty detail ends where the summary block ("Flight time", "Crew Information…") starts
    const stop = raw.filter(i => /^(Flight time|Crew Information|Hotels)/.test(i.str.trim()))
      .sort((a, b) => a.page - b.page || a.y - b.y)[0];
    // The summary (flight time, hotels, crew list) can start inside the last day column of a page:
    // drop only what sits below it in that column, and everything on later pages.
    const all = raw.filter(i => !stop || i.page < stop.page ||
      (i.page === stop.page && (i.y < stop.y - 4 || i.x < stop.x - 12)) || /Period:|Individual duty plan|contract:/.test(i.str));
    const text = raw.map(i => i.str).join(' ');
    const per = /Period:\s*(\d{2})([A-Z][a-z]{2})(\d{2})\s*-\s*(\d{2})([A-Z][a-z]{2})(\d{2})/.exec(text);
    if (!per) throw new Error('No encuentro el periodo del roster. ¿Es el "Individual duty plan" de IDP en PDF?');
    const year = 2000 + (+per[3]), month = MONTHS[per[2]];
    const startDay = +per[1], endDay = +per[4], endYear = 2000 + (+per[6]), endMonth = MONTHS[per[5]];
    const nMonths = Math.max(1, (endYear * 12 + endMonth) - (year * 12 + month) + 1);
    // day key = month offset * 100 + day; dates only carry the day, so a smaller day means the next month
    const offOf = (mo, yr) => (yr * 12 + mo) - (year * 12 + month);
    const findOff = makeOffFinder(year, month, nMonths);
    const nameM = /Individual duty plan\s+for\s+(.+?)\s*\((\d+)\)/.exec(text);
    const contract = (/contract:\s*(\S+)/.exec(text) || [])[1] || '';

    // header: rank + base under "CRM"
    let rank = null, base = null;
    const crm = all.find(i => i.str === 'CRM' && i.page === 0);
    if (crm) {
      const under = all.filter(i => i.page === 0 && Math.abs(i.x - crm.x) < 6 && i.y > crm.y + 3 && i.y < crm.y + 30).sort((a, b) => a.y - b.y);
      for (const u of under) { const t = u.str.trim(); if (/^(PU|CA|ST|SC|FA|CM)$/.test(t) && !rank) rank = t; else if (isStation(t) && !base) base = t; }
    }

    // detail blocks: dates like "Mon09" at the left of a column
    const days = {};
    // Columns are found per page: each page has its own left edges (e.g. 31 / 298), and a
    // stray date elsewhere on another page (crew-leg list) must not shift them.
    const colsByPage = {};
    for (const i of all) {
      if (!(dateRe.test(i.str.trim()) && i.y > 60)) continue;
      (colsByPage[i.page] = colsByPage[i.page] || []).push(i.x);
    }
    for (const p in colsByPage) {
      const xs = colsByPage[p].sort((a, b) => a - b), cl = [];
      for (const x of xs) { if (!cl.length || x - cl[cl.length - 1].max > 15) cl.push({ min: x, max: x }); else cl[cl.length - 1].max = x; }
      colsByPage[p] = cl.map(c => c.min);
    }
    const colOf = (page, x) => { const cx = colsByPage[page] || []; let c = -1; for (let k = 0; k < cx.length; k++) if (x >= cx[k] - 12) c = k; return c; };

    const byPageCol = {};
    for (const it of all) {
      if (it.y < 60 && it.page === 0) continue; // header grid
      const c = colOf(it.page, it.x); if (c < 0) continue;
      const key = it.page + ':' + c;
      (byPageCol[key] = byPageCol[key] || []).push({ ...it, rx: it.x - colsByPage[it.page][c], s: it.str.trim() });
    }
    let mOff = 0, lastD = 0;
    const pageKeys = Object.keys(byPageCol).sort((a, b) => { const [pa, ca] = a.split(':').map(Number), [pb, cb] = b.split(':').map(Number); return pa - pb || ca - cb; });
    for (const key of pageKeys) {
      const items = byPageCol[key].filter(i => i.s).sort((a, b) => a.y - b.y || a.x - b.x);
      if (!items.some(i => dateRe.test(i.s) && i.rx < 8)) continue;
      // group into lines
      const lines = [];
      for (const it of items) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.y - it.y) <= 1.5) last.items.push(it); else lines.push({ y: it.y, items: [it] });
      }
      let cur = null;
      for (const ln of lines) {
        ln.items.sort((a, b) => a.x - b.x);
        // brackets live at rx >= 205; split them off
        const main = ln.items.filter(i => i.rx < 205);
        const br = ln.items.filter(i => i.rx >= 205);
        if (main.length && dateRe.test(main[0].s) && main[0].rx < 8) {
          const dm0 = dateRe.exec(main[0].s), d = +dm0[2];
          mOff = findOff(dm0[1], d, mOff, lastD);
          lastD = d;
          const dk = mOff * 100 + d;
          cur = days[dk] = days[dk] || { day: d, events: [], dt: null, fdp: null, bt: null, hotel: null, notes: [] };
          main.shift();
        }
        if (!cur) continue;
        if (br.length) {
          const t = br.map(b => b.s).join(' ');
          const m = /\[(DT|BT|DP|FDP)\s*(\d{1,3}:\d{2})\]?/.exec(t);
          if (m) { const k = m[1].toLowerCase(); cur[k] = (cur[k] || 0) + hm(m[2]); }
        }
        if (!main.length) continue;
        const toks = main.map(i => ({ s: i.s, rx: i.rx }));
        const words = toks.map(t => t.s);
        const first = words.join(' ');
        if (/^To\b|^Ref:|^c\/m/.test(first)) continue;
        if (/^H\d{1,2}$/.test(words[0]) && toks[0].rx < 30) { cur.hotel = words.find(isStation) || null; continue; }
        // bucket by relative x
        const at = (lo, hi) => toks.filter(t => t.rx >= lo && t.rx < hi).map(t => t.s);
        const label = at(25, 95).join(' ');
        const dep = at(98, 118).find(isStation) || null;
        const t1 = at(118, 138).find(isTime) || null;
        const t2 = at(138, 158).find(isTime) || null;
        const arr = at(158, 182).find(isStation) || null;
        const info = at(182, 205).join(' ');
        const reserveMark = at(88, 100).includes('R');
        if (!label && !dep && !t1) { if (main.length) cur.notes.push(first); continue; }
        if (/^Pick Up/.test(label)) { cur.events.push({ type: 'pickup', t1 }); continue; }
        if (!label && (dep || t1)) { cur.notes.push(first); continue; }
        let m;
        if ((m = /^(DH\/)?([A-Z0-9]{2})\s*(\d{1,4}[A-Z]?)$/.exec(label)) && dep && arr && t1 && t2) {
          cur.events.push({ type: m[1] ? 'dh' : 'flt', flight: m[2] + ' ' + m[3], dep, arr, t1, t2, ac: info });
        } else if (/^C\/I$/.test(label)) {
          cur.events.push({ type: 'ci', st: dep, t1 });
        } else if (/^C\/O$/.test(label)) {
          cur.events.push({ type: 'co', st: arr || dep, t1: t2 || t1 });
        } else if (/^S\/U$/.test(label)) {
          cur.events.push({ type: 'su', st: dep, t1 });
        } else {
          cur.events.push({ type: 'code', code: label.split(' ')[0], label, st: dep || arr, t1, t2, arr, reserveMark });
        }
      }
    }

    // DT limit values (page with "Value for DT Limit Calc")
    const dtl = {};
    const re = /(\d{2})([A-Z][a-z]{2})(\d{2})\s+(\d{1,2}:\d{2})/g;
    const p3 = pages.map(p => p.items.slice().sort((a, b) => a.y - b.y || a.x - b.x).map(i => i.str).join(' ')).join(' ');
    if (/Limit Calc/.test(p3)) {
      const after = p3.slice(p3.indexOf('Limit Calc'));
      let m; while ((m = re.exec(after))) { const o = offOf(MONTHS[m[2]], 2000 + (+m[3])); if (o >= 0 && o < nMonths) dtl[o * 100 + (+m[1])] = hm(m[4]); }
    }
    const summary = {
      flightTime: hm((/Flight time\s+(\d+:\d{2})/.exec(text) || [])[1]),
      fdp: hm((/Alt\.\s*flight duty period\s+(\d+:\d{2})/.exec(text) || [])[1])
    };

    // crew lists ("Crew Information on Leg" / "on Ground Activity")
    const crew = parseCrew(raw, findOff);
    const checks = parseChecks(pages);

    const res = [];
    for (let o = 0; o < nMonths; o++) {
      const yy = year + Math.floor((month - 1 + o) / 12), mm = (month - 1 + o) % 12 + 1;
      const first = o === 0 && nMonths > 1 ? startDay : 1;
      const last = o === nMonths - 1 ? endDay : new Date(Date.UTC(yy, mm, 0)).getUTCDate();
      const out = [];
      for (let d = first; d <= last; d++) {
        const k = o * 100 + d;
        const x = days[k] || { day: d, events: [], dt: null, fdp: null, hotel: null, notes: [] };
        x.dtLimit = dtl[k] != null ? dtl[k] : null;
        x.date = `${yy}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        x.crew = crew.legs[k] || [];
        x.gcrew = crew.events[k] || [];
        out.push(x);
      }
      res.push({ parser: PARSER_V, year: yy, month: mm, crew: nameM ? nameM[1] : '', crewId: nameM ? nameM[2] : '', contract, rank, rankNorm: normRank(rank), base, days: out, from: o === 0 ? startDay : 1,
        to: last < new Date(Date.UTC(yy, mm, 0)).getUTCDate() ? last : undefined,
        summary: nMonths === 1 ? summary : { flightTime: null, fdp: null }, multi: nMonths > 1 ? nMonths : undefined, checks });
    }
    return res;
  }

  // ---------- crew lists ----------
  // Reading order: page, then column (x < 290 / < 565 / rest), then top to bottom. A leg line is
  // "Mon09 EW 9840 DUS 0525 0655 LIN", followed by "cockpit: CP Name", "FO Name", "cabin: PU Name",
  // "ST Name"…; a ground activity is "Tue03 DT_TRNG BER 0700 1700" followed by "crew on event:Name"
  // and one name per line.
  // Dates only say "Tue17": the month is the first one, from the current one on, where the 17th is a Tuesday
  // (going forward only when the day goes back or the weekday doesn't fit).
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function makeOffFinder(year, month, nMonths) {
    return (wd, d, off, lastD) => {
      if (nMonths <= 1) return 0;
      const fits = o => { const dt = new Date(Date.UTC(year, month - 1 + o, d)); return dt.getUTCDate() === d && dt.getUTCDay() === WD[wd]; };
      const from = d < lastD ? off + 1 : off;
      for (let o = from; o < nMonths; o++) if (fits(o)) return o;
      return Math.min(from, nMonths - 1);
    };
  }
  function parseChecks(pages) {
    const MON = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
    const out = [];
    pages.forEach(pg => {
      const h = pg.items.find(i => /^expiry/i.test(i.str.trim())); if (!h) return;
      const near = pg.items.filter(i => i.y > h.y + 2 && i.y < h.y + 260 && i.x >= h.x - 15 && i.x < h.x + 260);
      const rows = {};
      near.forEach(i => { const k = Math.round(i.y / 3); (rows[k] = rows[k] || []).push(i); });
      Object.values(rows).forEach(r => {
        r.sort((a, b) => a.x - b.x);
        const parts = r.map(i => i.str.trim()).join(' ').split(/\s+/);
        const m = /^(\d{2})([A-Z][a-z]{2})(\d{2})$/.exec(parts[0] || '');
        if (!m || !MON[m[2]] || !/^[A-Z0-9]{2,8}$/.test(parts[1] || '')) return;
        out.push({ exp: `20${m[3]}-${String(MON[m[2]]).padStart(2, '0')}-${m[1]}`, code: parts[1], name: parts.slice(2).join(' ') });
      });
    });
    return out;
  }
  function parseCrew(raw, findOff) {
    findOff = findOff || (() => 0);
    const legs = {}, events = {};
    const col = x => x < 290 ? 0 : x < 565 ? 1 : 2;
    const items = raw.filter(i => i.y > 115 && i.str.trim()).map(i => ({ ...i, c: col(i.x), s: i.str.trim() }))
      .sort((a, b) => a.page - b.page || a.c - b.c || a.y - b.y || a.x - b.x);
    const lines = [];
    for (const it of items) {
      const l = lines[lines.length - 1];
      if (l && l.page === it.page && l.c === it.c && Math.abs(l.y - it.y) <= 1.5) l.parts.push(it.s);
      else lines.push({ page: it.page, c: it.c, y: it.y, parts: [it.s] });
    }
    const ROLE = /^(CP|cp|FO|SO|SFO|PU|ST|SC|FA|CA|CC|PR|TR|JU|IN|OB)$/;
    const date = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{2})$/;
    let mode = null, cur = null, off = 0, lastD = 0;
    for (const l of lines) {
      const text = l.parts.join(' ').replace(/\s+/g, ' ').trim();
      if (/Crew Information on/.test(text)) { const nm = /Ground/.test(text) ? 'event' : /Leg/.test(text) ? 'leg' : mode; if (nm !== mode) { off = 0; lastD = 0; } mode = nm; cur = null; continue; }
      if (!mode) continue;
      if (/Legend|expiry date|^code description|^date flight|^Hotels|Flight time/.test(text)) { cur = null; continue; }
      const tok = text.split(' ');
      const dm = date.exec(tok[0]);
      if (dm) {
        const d0 = +dm[2];
        off = findOff(dm[1], d0, off, lastD);
        lastD = d0;
        const day = off * 100 + d0;
        const fl = /^(DH\/)?[A-Z0-9]{2}$/.test(tok[1]) && /^\d{1,4}[A-Z]?$/.test(tok[2]);
        if (fl) { cur = { type: 'leg', flight: tok[1] + ' ' + tok[2], dep: tok[3], t1: tok[4], arr: tok[tok.length - 1], members: [] }; (legs[day] = legs[day] || []).push(cur); }
        else { cur = { type: 'event', code: tok[1], st: /^[A-Z]{3}$/.test(tok[2]) ? tok[2] : '', names: [] }; (events[day] = events[day] || []).push(cur); }
        continue;
      }
      if (!cur) continue;
      if (cur.type === 'leg') {
        const t = tok.filter(x => !/^(cockpit|cabin):?$/.test(x));
        if (t.length > 1 && ROLE.test(t[0]) && /,/.test(text)) cur.members.push({ role: t[0], name: t.slice(1).join(' ') });
        else cur = null;
      } else {
        const name = text.replace(/^crew on event:\s*/, '').replace(/^crew on\s+event:\s*/, '');
        if (/,/.test(name) && !/\d/.test(name) && name.length < 60) cur.names.push(name);
        else if (!/^crew on/.test(text)) cur = null;
      }
    }
    return { legs, events };
  }

  // ---------- classification ----------
  const OFF_CODES = /^(O_|OFF|FREI|U_OFF|LV_OFF)/;
  function classify(day) {
    const ev = day.events;
    const codes = ev.filter(e => e.type === 'code').map(e => e.code);
    if (ev.some(e => e.type === 'flt')) return 'flight';
    // sick: KCC-SBY / KCC-FLD / KCC-GND (sick on a standby / flight / ground day), SICK, KRANK, AU
    if (codes.some(c => /^KCC|KRANK|SICK|^AU$/.test(c))) return 'sick';
    if (codes.some(c => /^STBY|^SBY|^RES(?!ERVE)/.test(c))) return 'standby';
    if (codes.some(c => /^RESERVE/.test(c))) return 'reserve';
    if (codes.some(c => /TRNG|SIM|CRS|^DT_|^CATR|^CAB_K/.test(c)) && !codes.some(c => /MEET/.test(c))) return 'training';
    if (codes.some(c => /MEET|OFFICE|DT_/.test(c))) return 'ground';
    if (ev.some(e => e.type === 'dh')) return 'deadhead';
    if (codes.length && codes.every(c => OFF_CODES.test(c))) return 'off';
    if (!ev.length) return 'empty';
    return 'other';
  }

  // ---------- pay computation ----------
  // salary level in a given month (art. 24.2 e–g): +1 level per full year in the category;
  // a date between day 1 and 15 counts from that month, otherwise from the next one
  function levelFor(s, year, month) {
    const max = s.rank === 'PU' ? 15 : 11;
    if (s.levelMode !== 'date' || !s.since) return Math.min(max, Math.max(s.rank === 'PU' ? 1 : 0, +s.level || 1));
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.since); if (!m) return +s.level || 1;
    let sy = +m[1], sm = +m[2]; if (+m[3] > 15) { sm++; if (sm > 12) { sm = 1; sy++; } }
    const months = (year * 12 + month) - (sy * 12 + sm);
    return Math.min(max, 1 + Math.max(0, Math.floor(months / 12)));
  }
  function normRank(r) { return !r ? null : (r === 'PU' ? 'PU' : 'CA'); }

  function compute(roster, s, extras) {
    extras = extras || {};
    s = Object.assign({}, s, { level: levelFor(s, roster.year, roster.month) });
    const R = rates(s, roster.year);
    const base = s.base || roster.base || 'PMI';
    const absenceSet = new Set(String(s.absenceCodes || '').split(/[,\s]+/).filter(Boolean).map(x => x.toUpperCase()));
    const trainSet = new Set(String(s.trainingCodes || '').split(/[,\s]+/).filter(Boolean).map(x => x.toUpperCase()));
    const ctSet = new Set(String(s.ctCodes || '').split(/[,\s]+/).filter(Boolean).map(x => x.toUpperCase()));
    let trainSeen = 0, ctSeen = 0;
    let lastCrew = [];
    let loc = base; // where you wake up
    let carryDuty = false;
    // A duty that started on the last night of the previous month (night rotation) shows up
    // on day 1 as legs from away without a check-in: it was already counted last month.
    { const d1 = roster.days[0], ev = d1 ? d1.events : [];
      const iFirstLeg = ev.findIndex(x => x.type === 'flt' || x.type === 'dh');
      const iCi = ev.findIndex(x => x.type === 'ci' || x.type === 'su');
      if (iFirstLeg >= 0 && ev[iFirstLeg].dep !== base && (iCi < 0 || iCi > iFirstLeg)) { loc = ev[iFirstLeg].dep; carryDuty = !d1.hotel; } }
    const days = roster.days.map(d => {
      const kind = classify(d);
      const codes = d.events.filter(e => e.type === 'code').map(e => e.code.toUpperCase());
      const absence = codes.some(c => absenceSet.has(c));
      // hours
      let F = d.fdp || 0;
      // Additional duty (art. 24.5.3 a) = duty time − FDP. Eurowings' "Value for DT Limit Calc" page
      // gives the duty time per calendar day, standby at home already at 25 %. A duty that crosses
      // midnight is split by date there, while its FDP sits on one day, so a day can come out
      // negative; only the month total matters (smoothed below). Checked: September 2026 → 12:57 h,
      // exactly what the October payslip paid.
      const isSby = codes.some(c => /^(STBY|SBY)/.test(c));
      let A;
      if (d.dtLimit != null) A = d.dtLimit - F;
      else if (d.dt != null) A = Math.max(0, d.dt - F);
      else A = 0;
      if (absence) { F = 3.5; A = 1.2; }
      // A standby day the roster lists without times or DT value (e.g. KCC-SBY) is paid like a
      // standby: 3 h additional duty (checked: June 2026 payslip, KCC-SBY on 1 May → +3:00 h).
      if (!absence && F === 0 && A <= 0 && codes.some(c => /SBY|STBY/.test(c)) && !d.events.some(e => e.t1)) A = 3;
      // locations
      const startLoc = loc;
      const stations = [];
      for (const e of d.events) {
        if (e.type === 'flt' || e.type === 'dh') { stations.push(e.dep, e.arr); }
        else if (e.st) stations.push(e.st);
        if (e.type === 'code' && e.arr) stations.push(e.arr);
      }
      let endLoc = d.hotel || (stations.length ? stations[stations.length - 1] : startLoc);
      if (d.hotel) endLoc = d.hotel;
      loc = endLoc;
      const visited = [startLoc, ...stations, endLoc].filter(Boolean);
      const away = visited.some(st => st !== base);
      // Per diem (art. 11 h). "Con pernocta" only when the roster books a hotel (H1 line).
      // A night rotation out of base that lands back after midnight has no hotel: one duty,
      // one per diem "sin pernocta", given on the day it starts and not again the next day.
      let dieta = 0, dietaType = null;
      // Every calendar day with time away from base earns one per diem (a night rotation PMI–NUE–PMI
      // over midnight = two days at 66,11 €), checked against the October 2026 payslip of an 80 % purser.
      carryDuty = false;
      // days off, holidays and other absences never earn a per diem, wherever the roster places them
      if (away && kind !== 'off' && kind !== 'empty' && !absence) {
        const intl = visited.some(st => !ES_AIRPORTS.has(st));
        const night = !!d.hotel;
        dietaType = (intl ? 'intl' : 'nat') + (night ? 'Night' : 'Day');
        dieta = DIETA[dietaType];
      }
      if (!d.hotel && endLoc !== base) carryDuty = true;   // duty runs past midnight
      // early check-in off base (00:00–05:00 local)
      let early = 0;
      const ci = d.events.find(e => e.type === 'ci' || e.type === 'su');
      // art. 24.9: check-in at a night stop between 00:00 and 05:00 local time
      if (ci && ci.st && ci.st !== base && startLoc !== base && ci.t1) {
        const lh = localHour(d.date, ci.t1, ci.st);
        if (lh >= 0 && lh < 5) early = s.earlyCheckin;
      }
      const ex = extras[d.date] || {};
      const pct = R.base / 100;   // full-time table base, without complements (art. 18.1)
      // art. 18.1.2: a day off bought by the company is marked OFF_BEZ in the roster. 9 % of the base,
      // half (4,5 %) when the duty starts after 16:00 or ends before 08:00 local time at base.
      let autoBuy = null, buyWhy = null;
      if (codes.some(c => /^OFF_BEZ/.test(c))) {
        const ciE = d.events.find(x => x.type === 'ci' || x.type === 'su' || (x.type === 'code' && /^STBY|^SBY/.test(x.code)));
        const coE = [...d.events].reverse().find(x => x.type === 'co');
        const startH = ciE && ciE.t1 ? localHour(d.date, ciE.t1, base) : null;
        const endH = coE && coE.t1 ? localHour(d.date, coE.t1, base) : null;
        autoBuy = ((startH != null && startH >= 16) || (endH != null && endH < 8)) ? 'half' : 'full';
        buyWhy = { start: startH, end: endH };
      }
      let buy = ex.buy === 'none' ? null : (ex.buy || autoBuy);
      if (ex.sim) {
        F = +ex.sim.F || 0; A = +ex.sim.A || 0;
        dietaType = ex.sim.dieta || null; dieta = dietaType ? DIETA[dietaType] : 0;
        early = ex.sim.early ? s.earlyCheckin : 0;
        buy = ex.sim.buy || null;
      }
      // art. 24.5.2 b: FDP is paid as scheduled at check-in, unless the actual one is more than 30 min longer
      const delay = Math.max(0, +ex.delay || 0), delayPaid = !ex.sim && F > 0 && delay > 30 ? delay / 60 : 0;
      F += delayPaid;
      const extraFix = (buy === 'full' ? 9 * pct : buy === 'half' ? 4.5 * pct : 0) + (ex.omDefer ? 4.5 * pct : 0);
      const sales = +ex.sales || 0;
      // trainer / competence team days: the monthly allowance covers the first day;
      // each further day adds what the works agreement table adds. Both on one day → the trainer day only.
      const isTrain = !!s.isTrainer && !(ex.sim && !ex.sim.train) && (ex.sim && ex.sim.train ? true : codes.some(c => [...trainSet].some(k => c.includes(k))));  // DT_TRNG, CATR_K2T1, CAB_K2_T1…
      const isCTday = !isTrain && !ex.sim && !!(s.isCT || s.isTrainer) && codes.some(c => [...ctSet].some(k => c.includes(k)));  // any code containing COMP
      let trainPay = 0, trainNo = 0, ctNo = 0;
      if (isTrain) { trainSeen++; trainNo = trainSeen;
        trainPay = trainSeen === 1 ? 0 : trainSeen === 2 ? (+s.tTwo - +s.tBase) : +s.tExtra; }
      if (isCTday) { ctSeen++; ctNo = ctSeen; trainPay = ctSeen === 1 ? 0 : +s.ctExtra; }
      // route
      const legs = d.events.filter(e => e.type === 'flt' || e.type === 'dh');
      const route = legs.length ? [legs[0].dep, ...legs.map(l => l.arr)].join('–') : '';
      const ciEv = d.events.find(e => e.type === 'ci' || e.type === 'su');
      const coEv = [...d.events].reverse().find(e => e.type === 'co');
      const codeEv = d.events.find(e => e.type === 'code' && !/^TAXI/.test(e.code));
      return {
        date: d.date, day: d.day, kind, codes, absence, F, A, H: F + A, startLoc, endLoc, away, dieta, dietaType, early,
        extraFix: r2(extraFix), sales, delay, delayPaid, isTrain, isCTday, trainNo, ctNo, trainPay, buy, autoBuy, buyWhy, buyManual: !!ex.buy, omDefer: !!ex.omDefer,
        legs, route, ci: ciEv ? ciEv.t1 : (codeEv ? codeEv.t1 : null),
        co: coEv ? coEv.t1 : (legs.length ? legs[legs.length - 1].t2 : (codeEv ? codeEv.t2 : null)),
        requested: d.events.some(x => x.reserveMark),
        label: codeEv ? codeEv.code : (legs.length ? '' : (codes[0] || '')), hotel: d.hotel, events: d.events,
        crew: (d.crew && d.crew.length) ? (lastCrew = d.crew) : (startLoc !== base && !legs.length ? lastCrew : (legs.length ? [] : (lastCrew = []))), crewInherited: !(d.crew && d.crew.length) && startLoc !== base && !legs.length && lastCrew.length > 0, gcrew: d.gcrew || []
      };
    });

    { let debt = 0;
      for (const d of days) { if (d.A < 0) { debt += -d.A; d.A = 0; } else if (debt > 0) { const t = Math.min(debt, d.A); d.A -= t; debt -= t; } }
      for (let i = days.length - 1; i >= 0 && debt > 0; i--) { const t = Math.min(debt, days[i].A); days[i].A -= t; debt -= t; }
      for (const d of days) d.H = d.F + d.A; }

    // monthly hour pay with tier ratio rule (art. 24.5.1 d)
    const TF = days.reduce((a, d) => a + d.F, 0), TA = days.reduce((a, d) => a + d.A, 0), T = TF + TA;
    const r = T > 0 ? TF / T : 0;
    const [L1, L2] = R.limits;
    const tierRate = i => r * R.fdp[i] + (1 - r) * R.add[i];
    let cum = 0;
    for (const d of days) {
      let h = d.H, pay = 0, start = cum;
      const parts = [[0, L1], [L1, L2], [L2, Infinity]];
      parts.forEach(([lo, hi], i) => {
        const a = Math.max(start, lo), b = Math.min(start + h, hi);
        if (b > a) pay += (b - a) * tierRate(i);
      });
      cum += h;
      d.hourPay = pay;
      d.hourRate = h > 0 ? pay / h : 0;
      d.tierEnd = cum;
      d.total = pay + d.dieta + d.early + d.extraFix + d.sales + d.trainPay;
    }
    const tiers = [[0, L1], [L1, L2], [L2, Infinity]].map(([lo, hi], i) => {
      const h = Math.max(0, Math.min(T, hi) - lo);
      const hF = r2(h * r), hA = r2(h * (1 - r));
      return { i, h, hF, hA, payF: r2(hF * R.fdp[i]), payA: r2(hA * R.add[i]), rateF: R.fdp[i], rateA: R.add[i] };
    });
    let hourPay = tiers.reduce((a, t) => a + t.payF + t.payA, 0);
    const minGuarantee = r2(49 * (s.contract / 100) * R.fdp[0] + 21 * (s.contract / 100) * R.add[0]);
    const topUp = hourPay < minGuarantee ? r2(minGuarantee - hourPay) : 0;
    const dietas = r2(days.reduce((a, d) => a + d.dieta, 0));
    // art. 11 h: per diems below 500 € (purser) / 400 € (cabin attendant) in a month are topped up.
    // The CLA text says until 31.12.2025; Eurowings keeps applying it in 2026 and 2027 (confirmed by crew).
    const guarantee = true;
    const dietaFloor = guarantee ? (s.rank === 'PU' ? 500 : 400) : 0;
    const dietasPaid = Math.max(dietas, dietaFloor);
    const early = days.reduce((a, d) => a + d.early, 0);
    const extraFix = r2(days.reduce((a, d) => a + d.extraFix, 0));
    const trainPay = r2(days.reduce((a, d) => a + d.trainPay, 0));
    const trainDays = days.filter(d => d.isTrain).length;
    const ctDays = days.filter(d => d.isCTday).length;
    // monthly allowance: the higher table entry applies once (trainer 270 € beats competence team 80 €)
    const allowBase = s.isTrainer ? +s.tBase : (s.isCT ? +s.ctBase : 0);
    const salesDays = r2(days.reduce((a, d) => a + d.sales, 0));
    const mk = roster.year + '-' + String(roster.month).padStart(2, '0');
    const monthSales = extras[mk] && extras[mk].sales != null && extras[mk].sales !== '' ? +extras[mk].sales : null;
    const sales = monthSales != null ? monthSales : (salesDays > 0 ? salesDays : (+s.salesEstimate || 0));
    const baseSalary = r2(R.base * s.contract / 100);
    const fixed = r2(baseSalary + allowBase + (+s.uniform || 0));
    const taxable = r2(fixed + hourPay + topUp + early + extraFix + sales + trainPay);
    const ss = r2(taxable * s.ss / 100);
    const irpf = r2(taxable * s.irpf / 100);
    const net = r2(taxable - ss - irpf + dietasPaid);
    const count = k => days.filter(d => d.dietaType === k).length;
    return {
      level: s.level, days, rates: R, TF, TA, T, r, tiers, hourPay: r2(hourPay), minGuarantee, topUp, dietas, dietasPaid, early, extraFix, sales,
      salesFromDays: monthSales != null || salesDays > 0, trainPay, trainDays, ctDays, allowBase, allowTotal: r2(allowBase + trainPay), baseSalary, fixed, taxable, ss, irpf, net,
      variable: r2(hourPay + topUp + dietasPaid + early + extraFix + sales + trainPay),
      dietaCounts: { intlNight: count('intlNight'), intlDay: count('intlDay'), natNight: count('natNight'), natDay: count('natDay') },
      blockHours: days.reduce((a, d) => a + d.legs.filter(l => l.type === 'flt').reduce((b, l) => b + blockLen(l), 0), 0)
    };
  }
  function blockLen(l) {
    const m = t => Math.floor(+t / 100) * 60 + (+t % 100);
    let x = m(l.t2) - m(l.t1); if (x < 0) x += 1440; return x / 60;
  }

  // ---------- payslip (nómina Eurowings Europe) ----------
  // Reads only what the pay rules need; personal data (DNI, IBAN, address) is never kept.
  function parsePayslip(items) {
    const text = items.map(i => i.str).join(' ');
    if (!/Conceptos de N[óo]mina|L[íi]quido a percibir/i.test(text)) return null;
    const num = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
    const under = label => {
      const h = items.find(i => i.str.trim() === label); if (!h) return null;
      const cands = items.filter(i => i.y > h.y + 4 && i.y < h.y + 22 && Math.abs(i.x - h.x) < 45);
      cands.sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x)); return cands[0] ? cands[0].str.trim() : null;
    };
    const lines = [];
    for (const it of items.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
      const l = lines[lines.length - 1];
      if (l && Math.abs(l.y - it.y) <= 2) l.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    const concepts = [];
    for (const l of lines) {
      const its = l.items.sort((a, b) => a.x - b.x);
      const code = its[0].str.trim();
      if (!/^\/?\d{3,4}$/.test(code) || its[0].x > 35) continue;
      const label = (its[1] && its[1].x < 160) ? its[1].str.trim() : '';
      const rest = its.slice(label ? 2 : 1);
      const retro = (rest.find(i => i.x > 150 && i.x < 200 && /^\d{6}$/.test(i.str.trim())) || {}).str || null;
      const numbers = rest.filter(i => /^-?[\d.]+,\d{2}$/.test(i.str.trim())).map(i => ({ x: i.x, v: num(i.str) }));
      concepts.push({ code, label, retro, numbers });
    }
    const col = (c, lo, hi) => { const n = c.numbers.find(n => n.x >= lo && n.x < hi); return n ? n.v : null; };
    const slipLines = concepts.map(c => ({ code: c.code, label: c.label, retro: c.retro,
      price: col(c, 190, 290), units: col(c, 290, 380), dev: col(c, 380, 480), ded: col(c, 480, 620) }));
    const numU = v => v && /[\d.]+,\d{2}/.test(v) ? num(v) : null;
    const slipTotals = { devengos: numU(under('Tot. Devengos')), deducciones: numU(under('Tot. Deducciones')),
      baseCC: numU(under('Base C.C.')), baseIRPF: numU(under('Base IMP')) };
    const amt = c => { const n = c.numbers.filter(n => n.x > 380); return n.length ? n[n.length - 1].v : null; };
    const pctOf = c => { const n = c.numbers.find(n => n.x > 320 && n.x < 380); return n ? n.v : null; };
    const get = code => concepts.filter(c => c.code === code && !c.retro);
    let per = /Periodo de liquidaci[óo]n\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
    if (!per) {
      // some payslips put the dates before the label in the text stream: take the first date on its line
      const h = items.find(i => /Periodo de liquidaci[óo]n/.test(i.str));
      const ds = h ? items.filter(i => Math.abs(i.y - h.y) < 4 && i.x > h.x && /^\s*\d{2}\/\d{2}\/\d{4}/.test(i.str)).sort((a, b) => a.x - b.x) : [];
      per = ds.length ? /(\d{2})\/(\d{2})\/(\d{4})/.exec(ds[0].str)
        : /(\d{2})\/(\d{2})\/(\d{4})\s*-\s*\d{2}\/\2\/\3/.exec(text);
    }
    const cat = under('Categoría profesional') || '';
    const cm = /^([CD])-?(\d{1,2})$/.exec(cat);
    const inc = under('Incremento Salarial');
    const incM = inc && /(\d{2})\/(\d{2})\/(\d{4})/.exec(inc);
    const out = {
      lines: slipLines, totals: slipTotals,
      period: per ? { month: +per[2], year: +per[3] } : null,
      rank: cm ? (cm[1] === 'C' ? 'PU' : 'CA') : null,
      level: cm ? +cm[2] : null,
      contract: num(under('% de Salario') || '100') || 100,
      nextIncrease: incM ? `${incM[3]}-${incM[2]}-${incM[1]}` : null,
      basePay: (get('1000')[0] && amt(get('1000')[0])) || null,
      trainerPlus: get('1046').reduce((a, c) => a + (amt(c) || 0), 0),
      uniform: (get('1047')[0] && amt(get('1047')[0])) || null,
      sales: get('5128').reduce((a, c) => a + (amt(c) || 0), 0),
      irpf: (get('/401')[0] && pctOf(get('/401')[0])) || null,
      joined: (() => { const v = under('Antigüedad') || under('Antiguedad'); const m = v && /(\d{2})\/(\d{2})\/(\d{4})/.exec(v); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; })(),
      net: (() => { const v = under('Importe'); return v && /[\d.]+,\d{2}/.test(v) ? num(v) : null; })(),
      ss: ['/350', '/370', '/380'].map(k => get(k)[0]).filter(Boolean).reduce((a, c) => a + (pctOf(c) || 0), 0) || null
    };
    // derive the anniversary: level L applies from (next increase − 1 year), level 1 from (next increase − L years)
    if (out.nextIncrease && out.level != null) {
      const [y, m, d] = out.nextIncrease.split('-').map(Number);
      out.since = `${y - Math.max(out.level, 1)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return out;
  }

  // ---------- the payslip of a given month, the way Eurowings pays it ----------
  // Fixed pay (base, trainer/CT allowance, uniform) of that month + variable pay
  // (hours, per diems, early check-in, extra trainer days, sales) generated in the month before.
  // oneOff: a one-time payment on this payslip (e.g. 5196 «Pago único»), taxed like salary
  function payslip(prev, s, year, month, oneOff) {
    oneOff = r2(+oneOff || 0);
    const lvl = levelFor(s, year, month);
    const baseSalary = r2((baseTab(s.rank, year, s)[lvl] || 0) * s.contract / 100);
    const allowBase = s.isTrainer ? +s.tBase : (s.isCT ? +s.ctBase : 0);
    const uniform = +s.uniform || 0;
    const v = prev || { hourPay: 0, topUp: 0, early: 0, extraFix: 0, sales: +s.salesEstimate || 0, trainPay: 0, dietasPaid: 0, dietas: 0, tiers: [], dietaCounts: {}, trainDays: 0, ctDays: 0, salesFromDays: false };
    const allowTotal = r2(allowBase + (v.trainPay || 0));
    // annual lump sum from 2027 (CA 800 €, PU 1.000 € gross a year), half in May and half in November,
    // prorated by the contract percentage
    const lumpSum = (newCla(s) && year >= 2027 && (month === 5 || month === 11)) ? r2((s.rank === 'PU' ? 500 : 400) * s.contract / 100) : 0;
    const taxable = r2(baseSalary + allowTotal + uniform + oneOff + lumpSum + v.hourPay + v.topUp + v.early + v.extraFix + v.sales);
    const ss = r2(taxable * s.ss / 100), irpf = r2(taxable * s.irpf / 100);
    // December: "Ayuda asesoramiento fiscal" for crew with seniority before 01/01/2023. No social
    // security and outside the normal IRPF base, but with its own "Ingreso a cuenta IRPF" at the
    // same rate (December 2025 payslip: 500,00 − 77,80 at 15,56 %).
    const fiscalAid = (month === 12 && s.joined && s.joined < '2023-01-01') ? (+s.fiscalAid || 0) : 0;
    const ingresoCta = r2(fiscalAid * s.irpf / 100);
    const fixedPay = r2(baseSalary + allowBase + uniform + oneOff + lumpSum);
    const fixed = r2(fixedPay + fiscalAid);
    const variable = r2(taxable - fixedPay + v.dietasPaid);      // hours, extras and per diems of the month before
    const ded = r2(ss + irpf + ingresoCta);
    return { year, month, level: lvl, baseSalary, allowBase, allowTotal, uniform, oneOff, lumpSum, fiscalAid, ingresoCta, prev: prev || null, v,
      fixed, variable, gross: r2(fixed + variable), ded,
      taxable, ss, irpf, dietas: v.dietasPaid, net: r2(taxable - ss - irpf + v.dietasPaid + fiscalAid - ingresoCta) };
  }

  // ---------- payslip from an image (screenshot / photo PDF), read with OCR ----------
  // words: [{t, x0, y0, x1, y1}] in image pixels, W = image width. Layout of the HCM "RECIBO DE NÓMINA":
  // label on the left, then right-aligned columns Imp./unidad · Número · Devengos · Deducciones.
  const MES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DIC: 12 };
  const OCR_CODES = [
    [/^salario base/, '1000'], [/^formaci[oó]n de cabina/, '1046'], [/^uniforme/, '1047'],
    [/^tiempo de vuelo\s*<\s*70/, '5122'], [/^tpo\.? vuelo adiciona\w*\s*<\s*70/, '5123'],
    [/^tiempo de vuelo\s*70/, '5124'], [/^tpo\.? vuelo adiciona\w*\s*70/, '5125'],
    [/^(tiempo|tpo\.?) de vuelo\s*>\s*110/, '5126'], [/^tpo\.? vuelo adiciona\w*\s*>\s*110/, '5127'],
    [/^comisi[oó]n de ventas/, '5128'], [/^pago [uú]nico/, '5196'],
    [/^viajes? inter\w* sin/, '8053'], [/^viajes? inter\w* con/, '8054'],
    [/^viajes? nac\w* sin/, '8051'], [/^viajes? nac\w* con/, '8052'],
    [/^trab\.?\s*cont\.?\s*comunes/, '/350'], [/^trab\.?\s*desempleo/, '/370'], [/^trab\.?\s*formac/, '/380'],
    [/^retenci[oó]n a cta/, '/401']
  ];
  function parsePayslipOcr(words, W) {
    const ws = words.filter(w => w.t && w.t.trim()).map(w => ({ ...w, t: w.t.trim(), cy: (w.y0 + w.y1) / 2 }));
    const lh = ws.length ? ws.map(w => w.y1 - w.y0).sort((a, b) => a - b)[Math.floor(ws.length / 2)] : 20;
    const lines = [];
    for (const w of ws.slice().sort((a, b) => a.cy - b.cy)) {
      const l = lines.find(l => Math.abs(l.cy - w.cy) < lh * 0.6);
      if (l) l.w.push(w); else lines.push({ cy: w.cy, w: [w] });
    }
    lines.forEach(l => { l.w.sort((a, b) => a.x0 - b.x0); l.text = l.w.map(w => w.t).join(' '); });
    const all = lines.map(l => l.text).join('\n');
    if (!/RECIBO DE N[OÓ]MINA|Salario Base/i.test(all) || !/Total a percibir|Total Devengos/i.test(all)) return null;
    const isNum = t => /^-?\d+([.,]\d{3})*[.,]\d{2,3}%?$/.test(t);
    const val = t => { t = t.replace('%', ''); if (/,\d{2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); return parseFloat(t); };
    const dateEs = t => { const m = /(\d{1,2})\.?\s*([A-Z]{3,4})\.?\s*(\d{4})/i.exec(t || ''); return m && MES[m[2].toUpperCase()] ? `${m[3]}-${String(MES[m[2].toUpperCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}` : null; };
    const after = (re) => { const l = lines.find(l => re.test(l.text)); if (!l) return ''; return l.text.replace(new RegExp('^.*?' + re.source, re.flags.replace('g', '')), '').trim(); };
    // the number under a heading (totals boxes)
    const below = (re, idx) => {
      const k = lines.findIndex(l => re.test(l.text)); if (k < 0) return null;
      for (let j = k + 1; j < Math.min(lines.length, k + 3); j++) { const n = lines[j].w.filter(w => isNum(w.t)); if (n.length) return val(n[Math.min(idx || 0, n.length - 1)].t); }
      return null;
    };
    // table: from "Salario Base" to "Informativo" / "Total Devengos"
    const start = lines.findIndex(l => /^Salario Base/i.test(l.text));
    let end = lines.findIndex((l, i) => i > start && /^(Informativo|Total Devengos)|Total Devengos/i.test(l.text));
    if (end < 0) end = lines.length;
    const baseNums = start >= 0 ? lines[start].w.filter(w => isNum(w.t)) : [];
    const devEnd = baseNums.length ? baseNums[baseNums.length - 1].x1 : W * 0.751;
    const step = W * 0.106;
    const cols = { price: devEnd - 2 * step, units: devEnd - step, dev: devEnd, ded: devEnd + step };
    const slipLines = [];
    for (let i = start; i >= 0 && i < end; i++) {
      const l = lines[i], nums = l.w.filter(w => isNum(w.t) && w.x0 > W * 0.4);
      const labelW = l.w.filter(w => w.x1 < W * 0.45 && !nums.includes(w));
      let label = labelW.map(w => w.t).join(' ').replace(/\s+/g, ' ').trim();
      if (!label) continue;
      const rm = /Atraso\s*\((\d{2})\/(\d{4})\)/i.exec(label);
      const retro = rm ? rm[2] + rm[1] : null;
      label = label.replace(/\s*-?\s*Atraso\s*\(\d{2}\/\d{4}\)/i, '').replace(/[|!]+$/, '').trim();
      const ln = { code: '', label, retro, price: null, units: null, dev: null, ded: null };
      const L = label.toLowerCase();
      for (const [re, code] of OCR_CODES) if (re.test(L)) { ln.code = code; break; }
      for (const n of nums) {
        let best = null, bd = Infinity;
        for (const [k, x] of Object.entries(cols)) { const d = Math.abs(n.x1 - x); if (d < bd) { bd = d; best = k; } }
        ln[best] = val(n.t);
      }
      if (ln.dev == null && ln.ded == null) continue;
      slipLines.push(ln);
    }
    const totals = { devengos: below(/Total Devengos/i, 0), deducciones: below(/Total Deducciones/i, 1), baseCC: null, baseIRPF: null };
    const net = below(/Total a percibir/i, 0);
    const pm = /(\d{2})\/(\d{4})/.exec(after(/PERIODO DE LIQUIDACI[OÓ]N/i)) || /PERIODO\.?\s*:?\s*\d{1,2}\.?\s*([A-Z]{3})\s*(\d{4})/i.exec(all);
    const period = pm ? { month: MES[pm[1]] || +pm[1], year: +pm[2] } : null;
    const cm = /([CD])\s*-\s*(\d{1,2})/.exec(after(/Categor[ií]a/i));
    const get = code => slipLines.filter(l => l.code === code && !l.retro);
    const sumDev = slipLines.reduce((a, l) => a + (l.dev || 0), 0), sumDed = slipLines.reduce((a, l) => a + (l.ded || 0), 0);
    // OCR self-check: the items must add up to the totals printed on the payslip
    const ok = totals.devengos != null && totals.deducciones != null && net != null &&
      Math.abs(sumDev - totals.devengos) < 0.05 && Math.abs(sumDed - totals.deducciones) < 0.05 && Math.abs(totals.devengos - totals.deducciones - net) < 0.05;
    const out = {
      ocr: true, ocrOk: ok, lines: slipLines, totals, period,
      rank: cm ? (cm[1] === 'C' ? 'PU' : 'CA') : null, level: cm ? +cm[2] : null,
      contract: (() => { const m = /^(\d{2,3})/.exec(after(/Porcentaje de salario/i)); return m ? +m[1] : 100; })(),
      nextIncrease: dateEs(after(/Incremento salarial/i)),
      basePay: (get('1000')[0] || {}).dev || null,
      trainerPlus: get('1046').filter(l => !/d[ií]a/i.test(l.label)).reduce((a, l) => a + (l.dev || 0), 0),
      uniform: (get('1047')[0] || {}).dev || null,
      sales: get('5128').reduce((a, l) => a + (l.dev || 0), 0),
      irpf: (get('/401')[0] || {}).units || null,
      joined: dateEs(after(/Antig[uü]edad/i)),
      net,
      ss: ['/350', '/370', '/380'].map(k => get(k)[0]).filter(Boolean).reduce((a, l) => a + (l.units || 0), 0) || null
    };
    if (out.nextIncrease && out.level != null) {
      const [y, m, d] = out.nextIncrease.split('-').map(Number);
      out.since = `${y - Math.max(out.level, 1)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return out;
  }

  return { maxFdp, tzOf, PARSER_V, localHour, payslip, parsePayslip, parsePayslipOcr, parseRoster, parseRosterAll, compute, rates, defaultSettings, levelFor, normRank, classify, DIETA, BASE, baseTab, hm, r2, ES_AIRPORTS };
})();
if (typeof module !== 'undefined') module.exports = PR;
