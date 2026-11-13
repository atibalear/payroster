// ---- Payroster: today card, roster changes, minimum rest, year in review, compare with a colleague, parents ----

const legMin = l => { if(!l.t1 || !l.t2) return 0; const a = +l.t1.slice(0,2)*60 + +l.t1.slice(2), b = +l.t2.slice(0,2)*60 + +l.t2.slice(2); return (b - a + 1440) % 1440; };
function kmBetween(a, b){
  const A = AP[a], B = AP[b]; if(!A || !B) return 0;
  const r = Math.PI/180, dLat = (B.lat-A.lat)*r, dLon = (B.lon-A.lon)*r;
  const h = Math.sin(dLat/2)**2 + Math.cos(A.lat*r)*Math.cos(B.lat*r)*Math.sin(dLon/2)**2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
// UTC instant of "HHMM" on a date (dates in the roster are local calendar days, times UTC)
const utcAt = (date, hhmmS) => Date.parse(date + 'T' + hhmmS.slice(0,2) + ':' + hhmmS.slice(2) + ':00Z');
const localHM = (ms, st) => new Intl.DateTimeFormat(LOC, { timeZone: PR.tzOf(st || state.settings.base || 'PMI'), hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(ms));
const localDay = (ms, st) => new Intl.DateTimeFormat(LOC, { timeZone: PR.tzOf(st || state.settings.base || 'PMI'), weekday:'short', day:'numeric', month:'short' }).format(new Date(ms));
const durTxt = ms => { const m = Math.max(0, Math.round(ms/60000)), d = Math.floor(m/1440), h = Math.floor(m%1440/60), mm = m%60;
  return (d ? d + ' d ' : '') + (d || h ? h + ' h ' : '') + (d ? '' : mm + ' min'); };

// every duty of all saved months, in order: {date, ci, co (ms UTC), st (check-in station), endSt, route, hotel, day}
// cached per roster object: duty times don't depend on the pay settings
const dutyCache = new WeakMap();
function allDuties(){
  const out = [];
  for(const k of Object.keys(state.months).sort()){
    const ro = state.months[k];
    if(!dutyCache.has(ro)) dutyCache.set(ro, monthDuties(ro));
    out.push(...dutyCache.get(ro));
  }
  return out;
}
function monthDuties(ro){
  const out = [], c = PR.compute(ro, state.settings, state.extras);
    for(const d of c.days){
      const ciE = (d.events||[]).find(e => e.type==='ci' || e.type==='su');
      if(!ciE || !ciE.t1) continue;
      const coE = [...(d.events||[])].reverse().find(e => e.type==='co');
      const start = utcAt(d.date, ciE.t1);
      let end = coE && coE.t1 ? utcAt(d.date, coE.t1) : (d.legs.length && d.legs[d.legs.length-1].t2 ? utcAt(d.date, d.legs[d.legs.length-1].t2) : null);
      if(end != null && end < start) end += 864e5;           // ends after midnight UTC
      if(end != null) end += dayDelay(d.date);
      out.push({ date:d.date, start, end, st: ciE.st || d.startLoc, endSt: d.endLoc, route: d.route || d.label || '', hotel: d.hotel, d, kind:d.kind });
    }
  return out;
}


// ---------- glossy 3D icons (own design, no emoji) ----------
const QI = {   // SF Symbols-like glyphs: filled shapes, one tint each
  mm:   ['#0a84ff','<path fill="currentColor" d="M9 4.2 3.9 6.1a1 1 0 0 0-.6.9v12.1a.7.7 0 0 0 .95.66L9 18V4.2zm1.6-.1V17.9l4.8 2V6.1l-4.8-2zM17 6.1v13.8l3.1-1.2a1 1 0 0 0 .6-.9V5.6a.7.7 0 0 0-.95-.66L17 6.1z"/>'],
  day:  ['#bf5af2','<path fill="currentColor" d="M7.5 3a1 1 0 0 1 1 1v1h7V4a1 1 0 1 1 2 0v1h.7A2.8 2.8 0 0 1 21 7.8v10.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 18.2V7.8A2.8 2.8 0 0 1 5.8 5h.7V4a1 1 0 0 1 1-1zM5 10v8.2c0 .44.36.8.8.8h12.4c.44 0 .8-.36.8-.8V10H5zm2.5 2h4v3h-4v-3z"/>'],
  crew: ['#30d158','<circle fill="currentColor" cx="9" cy="8.2" r="3.4"/><path fill="currentColor" d="M2.8 18.4c.5-3.3 3-5.2 6.2-5.2s5.7 1.9 6.2 5.2a.9.9 0 0 1-.9 1H3.7a.9.9 0 0 1-.9-1z"/><circle fill="currentColor" cx="16.8" cy="9" r="2.7"/><path fill="currentColor" d="M16.3 13.3c2.9-.3 4.7 1.3 5.1 4.2a.8.8 0 0 1-.8.9h-3.4a6.6 6.6 0 0 0-.9-5.1z"/>'],
  lay:  ['#ff9f0a','<path fill="currentColor" d="M3 6.5a1 1 0 0 1 2 0V13h6.5V9.8A1.8 1.8 0 0 1 13.3 8h4.4A3.3 3.3 0 0 1 21 11.3V18a1 1 0 1 1-2 0v-2H5v2a1 1 0 1 1-2 0V6.5z"/><circle fill="currentColor" cx="8" cy="10.2" r="2.1"/>'],
  rest: ['#5e5ce6','<path fill="currentColor" d="M10.2 3.3a.8.8 0 0 1 .9 1A7.3 7.3 0 0 0 19.7 13a.8.8 0 0 1 1 .9A9 9 0 1 1 10.2 3.3z"/><path fill="currentColor" d="M15 3.5h4.2a.75.75 0 0 1 .58 1.22L17 8h2.3a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.58-1.22L17.5 5H15a.75.75 0 0 1 0-1.5z"/>'],
  more: ['#8e8e93','<circle fill="currentColor" cx="5.5" cy="12" r="1.9"/><circle fill="currentColor" cx="12" cy="12" r="1.9"/><circle fill="currentColor" cx="18.5" cy="12" r="1.9"/>'],
  share:['#0a84ff','<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 14.5V3.5M8.2 7 12 3.3 15.8 7M8 10.5H6.6A1.6 1.6 0 0 0 5 12.1v6.3A1.6 1.6 0 0 0 6.6 20h10.8a1.6 1.6 0 0 0 1.6-1.6v-6.3a1.6 1.6 0 0 0-1.6-1.6H16"/>'],
  copy: ['#8e8e93','<rect fill="currentColor" x="8.5" y="8.5" width="12" height="12.5" rx="2.6"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 6.2V5.6A2.6 2.6 0 0 0 12.9 3H6.1A2.6 2.6 0 0 0 3.5 5.6v6.8A2.6 2.6 0 0 0 6.1 15h.4"/>'],
  cal:  ['#ff453a','<path fill="currentColor" d="M7.5 3a1 1 0 0 1 1 1v1h7V4a1 1 0 1 1 2 0v1h.7A2.8 2.8 0 0 1 21 7.8v10.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 18.2V7.8A2.8 2.8 0 0 1 5.8 5h.7V4a1 1 0 0 1 1-1zM5 10v8.2c0 .44.36.8.8.8h12.4c.44 0 .8-.36.8-.8V10H5z"/>']
};
function qIcon(k){ const q = QI[k] || QI.more;
  return `<span class="qi3" style="--qc:${q[0]}"><svg viewBox="0 0 24 24" aria-hidden="true">${q[1]}</svg></span>`; }

// ---------- 4. today / next duty ----------
let todayTimer = null;
// a delay entered for the day shifts the legs (and the end of duty): we are still on the ground
const dayDelay = date => Math.max(0, +((state.extras[date]||{}).delay) || 0) * 60e3;
const legStart = (date, l) => utcAt(date, l.t1) + dayDelay(date);
const legEnd = (date, l) => { let ms = utcAt(date, l.t2); if(+l.t2 < +l.t1) ms += 864e5; return ms + dayDelay(date); };
function renderToday(){
  const el = $('today'); if(!el) return;
  const now = Date.now(), duties = allDuties();
  const cur = duties.find(x => x.start <= now && x.end && x.end > now);
  const next = duties.find(x => x.start > now);
  if(!cur && !next){ el.hidden = true; return; }
  const x = cur || next, base = state.settings.base || 'PMI', st = x.st || base;
  const prev = !cur ? duties.filter(d => d.end && d.end <= now).pop() : null;
  const pk = pickupMs(x.date, x.d.events, x.start);
  const ftlA = typeof ftlAlertHtml === 'function' ? ftlAlertHtml() : '';
  const legs = (x.d.legs||[]).filter(l => l.t1 && l.t2);
  const nFlt = legs.filter(l => l.type === 'flt').length;

  // timeline: bed → alarm → pick-up → check-in (or check-in → check-out while on duty)
  const steps = [];
  if(cur){
    steps.push({ ic:'✓', lb: t('td_ci'), ms: x.start });
    if(x.end) steps.push({ ic:'🏁', lb: t('td_co'), ms: x.end, st: x.endSt || st });
  } else {
    const sp = sleepPlan(x.start, pk);
    if(sp.bed - now < 20*36e5){ steps.push({ ic:'😴', lb: t('td_bed'), ms: sp.bed, warn: now > sp.bed && now < sp.wake }); steps.push({ ic:'⏰', lb: t('td_alarm'), ms: sp.wake }); }
    if(pk) steps.push({ ic:'🚐', lb: t('td_pk'), ms: pk });
    steps.push({ ic:'✓', lb: t('td_ci'), ms: x.start });
  }
  const nextIdx = steps.findIndex(s => s.ms > now);
  const tl = `<div class="td-tl">${steps.map((s, i) => `<div class="td-st${i === nextIdx ? ' next' : ''}${s.ms <= now ? ' past' : ''}${s.warn ? ' warn' : ''}">
      <div class="lb">${s.ic} ${s.lb}</div><div class="tm">${localHM(s.ms, s.st || st)}</div>
      ${s.ms > now ? `<div class="in" data-at="${s.ms}">${durTxt(s.ms - now)}</div>` : '<div class="in">&nbsp;</div>'}</div>`).join('')}</div>`;

  // still on the ground? one tap adds a delay and the plane waits
  const lv = cur && legs.find(l => legStart(x.date, l) - 20*60e3 <= now && legEnd(x.date, l) > now);
  const dly = cur ? Math.round(dayDelay(x.date) / 60e3) : 0;
  const dlyRow = lv ? `<div class="mm-dly td-dly"><span class="note">${dly ? t('mm_dlyOn', {m: dly}) : t('td_gnd')}</span>${[15,30,60].map(v => `<button type="button" class="chip" data-tddly="${v}" data-d="${x.date}">+${v}′</button>`).join('')}${dly ? `<button type="button" class="chip" data-tddly="0" data-d="${x.date}">✕</button>` : ''}</div>` : '';
  // flights as 3D cards, weather on arrival filled in by loadWx
  const fl = legs.length ? `<div class="dlegs" style="margin-top:14px">${legs.map(l => { const t1 = legStart(x.date, l), t2 = legEnd(x.date, l), done = cur && t2 <= now, live = cur && t1 <= now && t2 > now;
      return `<div class="dleg${l.type==='dh'?' dh':''}${done ? ' past' : ''}${live ? ' live' : ''}"><span class="ap"><b>${l.dep}</b><small>${localHM(t1, l.dep)}</small></span>
        <span class="mid"><span class="fn">${l.type==='dh'?'DH ':''}${esc(l.flight)}</span><span class="ln"></span><span>${hhmm((t2-t1)/36e5)} h</span></span>
        <span class="ap r"><b>${l.arr}</b><small>${localHM(t2, l.arr)}</small><span class="wx" data-wx="${l.arr}|${t2}"></span></span></div>`; }).join('')}${dlyRow}</div>` : '';

  // rest: summary + EASA detail, shown from a quick action
  let restPanel = '', restLbl = t('qa_rest');
  const rd = cur ? null : prev && now - prev.end < 36*36e5 ? prev : null;
  if(rd){
    const home = (rd.endSt || base) === base && !rd.hotel, need = Math.max(rd.end - rd.start, (home ? 12 : 10) * 36e5), got = x.start - rd.end;
    restLbl = got >= 36*36e5 ? durTxt(got).replace(/ 0 min$/, '') : hhmm(got/36e5) + ' h' + (got >= need ? ' ✓' : ' ⚠');
    restPanel = `<div class="fdpl"><div><b>${got >= 36*36e5 ? t('td_restLong', {g: durTxt(got).replace(/ 0 min$/, '')}) : t('td_rest', {g: hhmm(got/36e5), n: hhmm(need/36e5)})}</b></div></div>${restHtml(rd.d)}`;
  } else restPanel = restHtml(x.d);
  const ls = x.hotel && x.hotel !== base ? x.hotel : (x.st && x.st !== base ? x.st : null);
  const meName = (state.months[x.date.slice(0,7)] || {}).crew;
  let crewP = typeof crewHtml === 'function' ? crewHtml(x.d, meName) : '';
  if(crewP) crewP = crewP.replace('<details class="crewbox dsec">', '<details class="crewbox dsec" open>');
  const crewN = crewP ? (crewP.match(/class="cm/g) || []).length : 0;
  const hasMm = legs.some(l => l.type==='flt' || l.type==='dh');
  const qa = [
    hasMm ? `<button type="button" class="qa" id="td-mm">${qIcon('mm')}<span>${t('qa_mm')}</span></button>` : '',
    crewP ? `<button type="button" class="qa" data-qp="crew">${qIcon('crew')}<span>${t('qa_crew')}${crewN ? ' · ' + crewN : ''}</span></button>` : `<button type="button" class="qa" data-wk="${x.date}">${qIcon('day')}<span>${t('qa_day')}</span></button>`,
    ls || x.hotel ? `<button type="button" class="qa" data-qp="lay">${qIcon('lay')}<span>${esc(x.hotel || ls)}</span></button>` : '',
    restPanel ? `<button type="button" class="qa" data-qp="rest">${qIcon('rest')}<span>${esc(restLbl)}</span></button>` : '',
    `<button type="button" class="qa" data-qsheet="1">${qIcon('more')}<span>${t('qa_more')}</span></button>`].join('');
  const endTxt = x.end ? localHM(x.end, x.endSt || st) : '';
  const sub = [localDay(x.start, st), nFlt ? t('td_sectors', {n: nFlt}) : '', endTxt ? t('td_until', {h: endTxt}) : ''].filter(Boolean).join(' · ');
  el.hidden = false;
  el.dataset.date = x.date;
  el.innerHTML = skyHtml(x, cur, pk, now, legs, st) + `<div class="td-route">${esc(x.route || kind(x.kind).n)}</div>
    <div class="note">${sub}</div>
    ${tl}${fl}
    <div class="qas">${qa}</div>
    <div class="qpanel" data-qpanel="lay" hidden>${x.hotel ? `<div class="td-hotel" id="tdHotel">🏨 ${t('nightIn',{st:x.hotel})}</div>` : ''}${ls ? layHtml(ls) : ''}</div>
    <div class="qpanel" data-qpanel="rest" hidden>${restPanel}</div>
    ${crewP ? `<div class="qpanel dx" data-qpanel="crew" hidden>${crewP}</div>` : ''}
    ${ftlA ? `<div class="chips" style="margin-top:10px">${ftlA}</div>` : ''}
    ${upcomingHtml(x, duties)}
    <div class="td-hint">${t('qa_hint')}</div>`;
  loadWx(x).catch(() => {});
  clearInterval(todayTimer);
  todayTimer = setInterval(() => { const c = $('today'); if(!c || c.hidden){ clearInterval(todayTimer); return; }
    for(const sp of c.querySelectorAll('[data-at]')){ const left = +sp.dataset.at - Date.now(); if(left <= 0){ renderToday(); return; } sp.textContent = durTxt(left); } }, 30000);
}

// ---------- 3. minimum rest (EASA ORO.FTL.235) ----------
// Rest before the next duty: at least as long as the duty just done, minimum 12 h at home base, 10 h away.
function restHtml(d){
  const duties = allDuties(), i = duties.findIndex(x => x.date === d.date); if(i < 0) return '';
  const x = duties[i]; if(!x.end) return '';
  const base = state.settings.base || 'PMI', home = (x.endSt || base) === base && !x.hotel;
  const need = Math.max(x.end - x.start, (home ? 12 : 10) * 36e5), earliest = x.end + need;
  const nx = duties[i+1];
  const st = x.hotel || x.endSt || base;
  let html = `<div class="fdpl"><div>${t('rest_min', {h: hhmm(need/36e5), w: home ? t('rest_home') : t('rest_away')})}</div>
    <div class="note">${t('rest_from', {d: localDay(earliest, st), t: localHM(earliest, st)})}</div>`;
  if(nx){
    const got = nx.start - x.end;
    if(got < need) html += `<div class="fdp-warn">${t('rest_short', {h: hhmm(got/36e5), n: localDay(nx.start, nx.st)+' '+localHM(nx.start, nx.st)})}</div>`;
    else html += `<div class="note">${t('rest_next', {h: hhmm(got/36e5)})}</div>`;
  }
  return html + '</div>';
}

// ---------- 1. what changed in a new roster ----------
function rosterDiff(oldRo, newRo){
  const s = state.settings;
  const co = PR.compute(oldRo, s, state.extras), cn = PR.compute(newRo, s, state.extras);
  const sig = d => [d.route || d.label || d.kind, d.ci || '', d.co || '', d.hotel || ''].join('|');
  const txt = d => (d.route || d.label || kind(d.kind).n) + (d.ci ? ' ' + t4(d.ci) + (d.co ? '–' + t4(d.co) : '') : '');
  const items = [];
  for(const n of cn.days){ const o = co.days.find(x => x.date === n.date); if(!o) continue;
    if(sig(o) !== sig(n)) items.push({ date:n.date, from: txt(o), to: txt(n), d: n.total - o.total }); }
  if(!items.length) return null;
  const [ny, nmo] = nextYM(newRo.year, newRo.month);
  const dNet = slipFor(cn, s, ny, nmo).net - slipFor(co, s, ny, nmo).net;
  return { at: todayISO(), items, dNet: PR.r2(dNet) };
}
function renderChanges(ro){
  const el = $('chgCard'); if(!el) return;
  const ch = ro && (state.changes||{})[key(ro)];
  if(!ch){ el.hidden = true; el.innerHTML = ''; return; }
  const dd = iso => new Date(iso+'T12:00').toLocaleDateString(LOC,{weekday:'short', day:'numeric'});
  el.hidden = false;
  el.innerHTML = `<div class="row" style="justify-content:space-between;align-items:baseline"><b>${t('chg_title',{n:ch.items.length, m:monthName(ro.year, ro.month)})}</b>
      <button class="btn ghost" id="chg-x" type="button" data-k="${key(ro)}">${t('chg_ok')}</button></div>
    <div class="mlist" style="margin-top:8px">${ch.items.map(i => `<div class="mrow"><div class="mh">${dd(i.date)}</div>
      <div class="note"><s>${esc(i.from)}</s> → <b>${esc(i.to)}</b>${Math.abs(i.d) >= 0.5 ? ` · <span class="${i.d<0?'neg':'pos'}">${i.d>0?'+':''}${eur.format(i.d)}</span>` : ''}</div></div>`).join('')}</div>
    <p class="note" style="margin:8px 0 0">${t('chg_net', {v: (ch.dNet>0?'+':'') + eur.format(ch.dNet)})}</p>`;
}

// ---------- 2. year in review ----------
function renderWrap(){
  const years = [...new Set(Object.keys(state.months).map(k => +k.slice(0,4)))].sort().reverse();
  const ro0 = state.months[state.current];
  const y = +(($('wr-y')||{}).value) || (ro0 ? ro0.year : years[0]);
  if(!years.length){ pnl(hdr('wrap') + `<p class="msg">${t('startText')}</p>`); return; }
  const me = (ro0 && ro0.crew) || '';
  let sectors = 0, dh = 0, blockMin = 0, km = 0, nights = 0, duties = 0, off = 0, earliest = null, longest = null;
  const apCount = {}, hotelCount = {}, crewCount = {}, routeCount = {}, countries = new Set(), monthsIn = [];
  for(const k of Object.keys(state.months).filter(k => +k.slice(0,4) === y).sort()){
    monthsIn.push(+k.slice(5));
    const c = PR.compute(state.months[k], state.settings, state.extras);
    for(const d of c.days){
      if(d.hotel){ nights++; hotelCount[d.hotel] = (hotelCount[d.hotel]||0) + 1; }
      if(d.kind === 'off') off++;
      const ciE = (d.events||[]).find(e => e.type==='ci');
      if(ciE && ciE.t1){ duties++;
        const lh = PR.localHour(d.date, ciE.t1, ciE.st || d.startLoc);
        if(lh >= 2 && (!earliest || lh < earliest.h)) earliest = { h: lh, date: d.date, st: ciE.st || d.startLoc, route: d.route }; }
      if(d.F && (!longest || d.F > longest.F) && d.legs.length) longest = { F: d.F, date: d.date, route: d.route };
      for(const l of d.legs){
        if(l.type === 'dh'){ dh++; continue; }
        sectors++; blockMin += legMin(l); km += kmBetween(l.dep, l.arr);
        apCount[l.arr] = (apCount[l.arr]||0) + 1; { const rk = [l.dep, l.arr].sort().join('–'); routeCount[rk] = (routeCount[rk]||0) + 1; }
        [l.dep, l.arr].forEach(a => AP[a] && countries.add(AP[a].cc));
      }
      if(!d.crewInherited) for(const leg of d.crew||[]) for(const m of leg.members||[]) if(m.name && m.name !== me) crewCount[m.name] = (crewCount[m.name]||0) + 1;
    }
  }
  const top = (o, n) => Object.entries(o).sort((a,b) => b[1]-a[1]).slice(0, n);
  const yd = typeof yearData === 'function' ? yearData(y).filter(r => !r.partial) : [];
  const netSum = yd.reduce((a,r) => a + (r.net||0), 0);
  const nice = n => n.split(',').reverse().map(s => s.trim()).join(' ');
  const card = (big, small) => `<div class="wcard"><div class="wbig">${big}</div><div class="note">${small}</div></div>`;
  const city = a => AP[a] ? AP[a].city : a;
  pnl(hdr('wrap', t('wr_intro')) + `<label class="note">${t('yr_year')} <select id="wr-y">${years.map(x => `<option${x===y?' selected':''}>${x}</option>`).join('')}</select></label>
    <p class="note">${t('wr_months', {m: monthsIn.map(m => nm(y, m, {month:'short'})).join(' · ')})}</p>
    <div class="wgrid">
      ${card(n2.format(Math.round(km)).replace(/[.,]00$/,'') + ' km', t('wr_km', {x: (km/40075).toFixed(1)}))}
      ${card(sectors, t('wr_sectors', {d: dh}))}
      ${card(hhmm(blockMin/60) + ' h', t('wr_block'))}
      ${card(Object.keys(apCount).length, t('wr_airports', {c: countries.size}))}
      ${card(nights, t('wr_nights'))}
      ${card(duties, t('wr_duties', {o: off}))}
      ${netSum ? card(eur0.format(netSum), t('wr_net', {n: yd.length})) : ''}
    </div>
    ${Object.keys(apCount).length ? `<h3 class="wh">${t('wr_topAp')}</h3><div class="chips">${top(apCount, 8).map(([a,n]) => `<span class="chip">${esc(city(a))} (${a}) <b>${n}</b></span>`).join('')}</div>` : ''}
    ${Object.keys(routeCount).length ? `<h3 class="wh">${t('wr_topRoute')}</h3><div class="chips">${top(routeCount, 6).map(([a,n]) => `<span class="chip">${a} <b>${n}</b></span>`).join('')}</div>` : ''}
    ${countries.size ? `<h3 class="wh">${t('wr_countries')}</h3><div class="chips">${[...countries].sort().map(c => `<span class="chip">${String.fromCodePoint(...[...c.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0)))} ${c}</span>`).join('')}</div>` : ''}
    ${Object.keys(hotelCount).length ? `<h3 class="wh">${t('wr_topHotel')}</h3><div class="chips">${top(hotelCount, 5).map(([a,n]) => `<span class="chip">${esc(city(a))} <b>${n}</b></span>`).join('')}</div>` : ''}
    ${Object.keys(crewCount).length ? `<h3 class="wh">${t('wr_topCrew')}</h3><div class="chips">${top(crewCount, 8).map(([a,n]) => `<span class="chip">${esc(nice(a))} <b>${n}</b></span>`).join('')}</div>` : ''}
    <div class="mlist" style="margin-top:12px">
      ${earliest ? `<div class="mrow"><div class="mh nc">${t('wr_early')}</div><div class="note">${String(Math.floor(earliest.h)).padStart(2,'0')}:${String(Math.round(earliest.h%1*60)).padStart(2,'0')} · ${new Date(earliest.date+'T12:00').toLocaleDateString(LOC,{day:'numeric',month:'short'})} · ${esc(earliest.route||earliest.st)}</div></div>` : ''}
      ${longest ? `<div class="mrow"><div class="mh nc">${t('wr_long')}</div><div class="note">${hhmm(longest.F)} h · ${new Date(longest.date+'T12:00').toLocaleDateString(LOC,{day:'numeric',month:'short'})} · ${esc(longest.route)}</div></div>` : ''}
    </div>
    <p class="note">${t('wr_note')}</p>`);
}

// ---------- 5. compare with a colleague (a roster shared with you) ----------
let cmpCache = {};
async function renderCmp(){
  const sh = state.shared || {}, ks = Object.keys(sh).sort().reverse();
  if(!ks.length){ pnl(hdr('cmp', t('cmp_intro')) + `<p class="msg">${t('cmp_none')}</p>`); return; }
  const sel = ($('cmp-k')||{}).value || ks[0];
  pnl(hdr('cmp', t('cmp_intro')) + `<label class="note">${t('cmp_who')} <select id="cmp-k">${ks.map(k => { const x = sh[k];
      return `<option value="${esc(k)}"${k===sel?' selected':''}>${esc(x.n || '?')} · ${monthName(x.y, x.m, {month:'long', year:'numeric'})}</option>`; }).join('')}</select></label><div id="cmp-out"><p class="note">…</p></div>`);
  let p = cmpCache[sel];
  if(!p){ try{ p = cmpCache[sel] = await decodeShare(sh[sel].s); }catch(e){ $('cmp-out').innerHTML = `<p class="msg err">${t('v_bad')}</p>`; return; } }
  const theirs = p.v === 2 ? p.days : unpackDays(p);
  const ro = state.months[kOf(p.y, p.m)];
  if(!ro){ $('cmp-out').innerHTML = `<p class="msg err">${t('cmp_noMine', {m: monthName(p.y, p.m, {month:'long', year:'numeric'})})}</p>`; return; }
  const mine = PR.compute(ro, state.settings, state.extras).days;
  const isOff = d => !d || d.kind === 'off' || d.kind === 'empty' || (!(d.legs||[]).length && /^(U|SU|O_|FREI|OFF)/i.test(d.label || ''));
  const lbl = d => !d ? '—' : esc(d.route || d.label || kind(d.kind).n) + (d.ci ? ` <span class="mono">${t4(d.ci)}</span>` : '');
  let both = 0, same = 0, swapA = 0, swapB = 0;
  const rows = mine.map(m => {
    const o = theirs.find(x => x.date === m.date);   // a day missing from the shared roster is an empty day
    const fl = new Set(m.legs.filter(l => l.type==='flt').map(l => l.flight));
    const together = !!o && (o.legs||[]).some(l => fl.has(l.flight));
    let tag = '';
    if(isOff(m) && isOff(o)){ both++; tag = `<span class="chip c-vac">${t('cmp_bothOff')}</span>`; }
    else if(together){ same++; tag = `<span class="chip c-bez">${t('cmp_same')}</span>`; }
    else if(isOff(m)){ swapA++; tag = `<span class="chip">${t('cmp_meOff')}</span>`; }
    else if(isOff(o)){ swapB++; tag = `<span class="chip">${t('cmp_themOff')}</span>`; }
    const dd = new Date(m.date+'T12:00').toLocaleDateString(LOC, {weekday:'short', day:'numeric'});
    const canSwap = !together && !(isOff(m) && isOff(o)) && !!o;
    return `<div class="mrow"><div class="mh">${dd} ${tag}</div><div class="cmp2"><div><span class="note">${t('cmp_me')}</span> ${lbl(m)}</div><div><span class="note">${esc(p.n || t('cmp_them'))}</span> ${lbl(o)}</div></div>${canSwap ? `<label class="chk swp"><input type="checkbox" data-swp="${m.date}"> 💱 ${t('swp_take')}</label>` : ''}</div>`;
  }).join('');
  cmpCur = { ro, theirs };
  $('cmp-out').innerHTML = `<p class="msg">${t('cmp_sum', {b: both, s: same, a: swapA, o: swapB})}</p>
    <p class="note">${t('swp_hint')}</p><div class="row"><button class="btn" id="cmp-swp" type="button">💱 ${t('swp_calc')}</button></div><div id="swp-out"></div>
    <div class="mlist" style="margin-top:10px">${rows}</div>`;
}

// ---------- 6. parents: birth leave, breastfeeding / infant care ----------
// Spain 2026: 19 weeks per parent (RDL 9/2025): 6 compulsory right after the birth, 11 more within the first
// 12 months, 2 more until the child is 8. INSS pays 100 % of the regulatory base (contribution base for
// common contingencies of the month before / 30, capped at the maximum base), with no deductions and no IRPF.
const MAX_BASE_2026 = 5101.20;
function famBase(startISO){
  const [y, m] = startISO.split('-').map(Number), [py, pm] = prevYM(y, m);
  const sl = (state.slips||{})[kOf(py, pm)];
  if(sl && sl.totals && sl.totals.baseCC) return { v: sl.totals.baseCC, src: 'slip', m: nm(py, pm) };
  const ks = Object.keys(state.slips||{}).filter(k => k < kOf(y, m) && (state.slips[k].totals||{}).baseCC).sort();
  if(ks.length){ const k = ks[ks.length-1]; const [a,b] = k.split('-').map(Number); return { v: state.slips[k].totals.baseCC, src: 'slip', m: nm(a, b) }; }
  // estimate: taxable pay of the last month the app can calculate
  const mk = Object.keys(state.months).sort().pop();
  if(mk){ const ro = state.months[mk], [ny, nmo] = nextYM(ro.year, ro.month), P = slipFor(PR.compute(ro, state.settings, state.extras), state.settings, ny, nmo); return { v: P.taxable, src: 'est', m: nm(ny, nmo) }; }
  return { v: 0, src: 'none' };
}
function normalNet(){
  const ks = Object.keys(state.slips||{}).sort().slice(-6), v = ks.map(k => state.slips[k].net).filter(x => x > 0);
  return v.length ? v.reduce((a,b) => a+b, 0) / v.length : 0;
}
// normal net for a calendar month: the same month a year earlier if you have that payslip (summer
// flying pays more than winter), otherwise the average of your last payslips
function monthNormal(y, m){
  const sl = state.slips || {}, k = kOf(y-1, m);
  if(sl[k] && sl[k].net > 0) return { v: sl[k].net, src: 'ly' };
  if(sl[kOf(y, m)] && sl[kOf(y, m)].net > 0) return { v: sl[kOf(y, m)].net, src: 'ty' };
  return { v: normalNet(), src: 'avg' };
}
function famLeaveDays(f){
  const out = new Set(), add = (s, w) => { if(!s || !(w > 0)) return; const a = Date.parse(s+'T12:00'); for(let i = 0; i < w*7; i++) out.add(new Date(a + i*864e5).toISOString().slice(0,10)); };
  const w1 = Math.min(17, Math.max(6, +f.weeks || 17));
  add(f.birth, w1);
  for(const bl of (f.blocks||[])) add(bl.s, +bl.w);
  return out;
}
function renderFam(){
  const f = state.fam = state.fam || {};
  const role = f.role || 'other', ad = role === 'adopt';
  const birth = f.birth || '', weeks = Math.min(17, Math.max(6, +f.weeks || 17));
  f.blocks = (f.blocks||[]).filter(b => b && b.w > 0);
  const used = weeks + f.blocks.reduce((a, b) => a + (+b.w||0), 0), left = Math.max(0, 17 - used);
  const blkRows = f.blocks.map((bl, i) => `<div class="fam-blk"><label>${t('fam_blkStart')}<input type="date" data-famblk="${i}" data-f="s" value="${esc(bl.s||'')}"></label>
      <label>${t('fam_blkW')}<select data-famblk="${i}" data-f="w">${[...Array(Math.max(+bl.w||1, (+bl.w||0) + left))].map((_, j) => j+1).map(w => `<option value="${w}"${w===+bl.w?' selected':''}>${t('fam_wk',{n:w})}</option>`).join('')}</select></label>
      <button class="btn ghost" type="button" data-famdel="${i}">✕</button></div>`).join('');
  const form = `<div class="seg famrole" role="group" aria-label="${t('fam_roleT')}">${['other','adopt'].map(r => { const on = r === 'adopt' ? ad : !ad; return `<button type="button" data-famrole="${r}" class="${on ? 'on' : ''}" aria-pressed="${on}">${t('fam_r_'+r)}</button>`; }).join('')}</div>
    <div style="height:10px"></div>
    <div class="form" style="margin-top:0">
      <label>${t(ad ? 'fam_resol' : 'fam_birth')}<input type="date" id="fam-birth" value="${esc(birth)}"></label>
      ${ad ? `<label>${t('fam_child')}<input type="date" id="fam-child" value="${esc(f.child||'')}"></label>` : ''}
      <label>${t(ad ? 'fam_weeksA' : 'fam_weeks')}<select id="fam-weeks">${[6,7,8,9,10,11,12,13,14,15,16,17].filter(w => w <= 17 - (used - weeks)).map(w => `<option value="${w}"${w===weeks?' selected':''}>${t('fam_wk',{n:w})}</option>`).join('')}</select></label>
      <label>${t('fam_base')}<input type="text" inputmode="decimal" id="fam-base" value="${f.base ? f.base : ''}" placeholder="auto"></label>
    </div>
    ${birth ? `<h3 class="wh">${t('fam_blkT')}</h3><p class="note" style="margin-top:0">${t(ad ? 'fam_blkNoteA' : 'fam_blkNote', {n: left})}</p>${blkRows}
      ${left > 0 ? `<button class="btn ghost" id="fam-add" type="button">＋ ${t('fam_blkAdd')}</button>` : ''}` : ''}
    <div style="margin-top:10px"><button class="btn" id="fam-save" type="button">${t('fam_calc')}</button></div>`;
  if(!birth){ pnl(hdr('fam', t('fam_intro')) + form + famInfo()); return; }
  const b = famBase(birth);
  const base = Math.min(+f.base || b.v || 0, MAX_BASE_2026), daily = base / 30;
  const leave = famLeaveDays(f), ld = [...leave].sort();
  const endMs = Date.parse(birth + 'T12:00') + (weeks * 7 - 1) * 864e5;
  const lastDay = ld[ld.length - 1] || birth;
  const rows = []; let tot = 0, totN = 0, anyLy = false;
  for(let [y, m] = birth.split('-').map(Number); kOf(y, m) <= lastDay.slice(0,7); [y, m] = nextYM(y, m)){
    const dim = new Date(y, m, 0).getDate(), pre = kOf(y, m) + '-';
    let days = 0; for(let d = 1; d <= dim; d++) if(leave.has(pre + String(d).padStart(2,'0'))) days++;
    if(!days) continue;
    const N = monthNormal(y, m), normal = N.v; if(N.src === 'ly') anyLy = true;
    const inss = daily * days, comp = normal * (dim - days) / dim, diff = inss + comp - normal;
    tot += inss + comp; totN += normal;
    rows.push(`<tr><td>${nm(y, m, {month:'short', year:'numeric'})}</td><td>${days}</td><td>${eur.format(inss)}</td><td>${normal ? eur.format(comp) : '—'}</td><td><b>${eur.format(inss + comp)}</b>${normal ? `<br><small class="${diff < 0 ? 'neg' : 'pos'}">${diff >= 0 ? '+' : ''}${eur.format(diff)}</small>` : ''}</td></tr>`);
  }
  // which months cost least: lowest normal pay (needs payslips of the year before)
  const cheap = [];
  if(Object.keys(state.slips||{}).length >= 6){
    const by = birth.split('-').map(Number), list = [];
    for(let i = 0, y = by[0], m = by[1]; i < 12; i++, [y, m] = nextYM(y, m)){ const N = monthNormal(y, m); if(N.src !== 'avg') list.push({ y, m, v: N.v }); }
    list.sort((a, b) => a.v - b.v).slice(0, 3).forEach(x => cheap.push(nm(x.y, x.m, {month:'long'})));
  }
  const kid = ad ? f.child : birth, d9 = new Date(Date.parse((kid || birth)+'T12:00')); d9.setMonth(d9.getMonth() + 9);
  const back = new Date(Date.parse(lastDay+'T12:00') + 864e5);
  let wd = 0; for(let x = back.getTime(); x < d9.getTime(); x += 864e5){ const g = new Date(x).getDay(); if(g && g < 6) wd++; }
  const lact = Math.round(wd / 8);
  const late = f.blocks.some(bl => bl.s && Date.parse(bl.s+'T12:00') + bl.w*7*864e5 > Date.parse(birth+'T12:00') + 366*864e5);
  pnl(hdr('fam', t('fam_intro')) + form + `
    <p class="msg">${t('fam_sum', {s: new Date(birth+'T12:00').toLocaleDateString(LOC), e: new Date(endMs).toLocaleDateString(LOC), w: weeks, d: eur.format(daily), m: eur.format(daily*30)})}</p>
    <p class="note">${b.src === 'slip' ? t('fam_baseSlip', {v: eur.format(b.v), m: b.m}) : b.src === 'est' ? t('fam_baseEst', {v: eur.format(b.v)}) : ''}${(+f.base || b.v) > MAX_BASE_2026 ? ' ' + t('fam_cap', {v: eur.format(MAX_BASE_2026)}) : ''}</p>
    <div class="tablewrap"><table class="slip famt"><tr class="sec"><td>${t('fam_month')}</td><td>${t('fam_days')}</td><td>INSS</td><td>Eurowings</td><td>${t('fam_total')}</td></tr>${rows.join('')}</table></div>
    ${totN ? `<p class="note">${t('fam_vs', {n: eur.format(totN / Math.max(1, rows.length)), t: eur.format(tot), d: (tot-totN>=0?'+':'') + eur.format(tot - totN)})} ${anyLy ? t('fam_seasonal') : ''}</p>` : `<p class="note">${t('fam_noNormal')}</p>`}
    ${cheap.length ? `<p class="msg">💡 ${t('fam_cheap', {m: cheap.join(', ')})}</p>` : ''}
    ${late ? `<p class="msg err">${t(ad ? 'fam_lateA' : 'fam_late')}</p>` : ''}
    ${left > 0 ? `<p class="note">${t('fam_rest', {n: left, d: new Date(Date.parse(birth+'T12:00') + 365*864e5).toLocaleDateString(LOC)})}</p>` : ''}
    <h3 class="wh">${t('fam_lactT')}</h3>
    <p class="note">${ad && !kid ? t('fam_lactNoKid') : back >= d9 ? t('fam_lactNo', {d: d9.toLocaleDateString(LOC)}) : t('fam_lact', {d: d9.toLocaleDateString(LOC), b: back.toLocaleDateString(LOC), n: lact})}</p>
    ${famInfo()}`);
}
function famInfo(){
  return `<h3 class="wh">${t('fam_infoT')}</h3><ul class="note famul">
    <li>${t('fam_i1')}</li><li>${t('fam_i2')}</li><li>${t('fam_i3')}</li><li>${t('fam_i4')}</li><li>${t('fam_i5')}</li></ul>
    <p class="note">${t('fam_disc')}</p>`;
}

function famRead(f){ document.querySelectorAll('[data-famblk]').forEach(el => { const b = (f.blocks||[])[+el.dataset.famblk]; if(b) b[el.dataset.f] = el.dataset.f === 'w' ? +el.value : el.value; }); }
// tool events
document.addEventListener('change', e => {
  if(e.target.id === 'wr-y'){ renderWrap(); return; }
  if(e.target.id === 'cmp-k'){ renderCmp(); return; }
  if(e.target.dataset && e.target.dataset.famblk != null){ famRead(state.fam); save(); renderFam(); return; }
});
document.addEventListener('click', e => {
  const id = e.target.id;
  if(id === 'chg-x'){ delete (state.changes||{})[e.target.dataset.k]; save(); renderChanges(null); return; }
  const fr = e.target.closest('[data-famrole]'); if(fr){ const f = state.fam = state.fam || {}; famRead(f);
    if($('fam-birth')) f.birth = $('fam-birth').value || f.birth || ''; f.role = fr.dataset.famrole; save(); renderFam(); return; }
  if(id === 'fam-add'){ const f = state.fam = state.fam || {}; famRead(f);
    const last = famLeaveDays(f), ls = [...last].sort().pop() || f.birth; const d = new Date(Date.parse(ls+'T12:00') + 864e5);
    (f.blocks = f.blocks || []).push({ s: d.toISOString().slice(0,10), w: 1 }); save(); renderFam(); return; }
  const fd = e.target.closest('[data-famdel]'); if(fd){ const f = state.fam; famRead(f); f.blocks.splice(+fd.dataset.famdel, 1); save(); renderFam(); return; }
  if(id === 'fam-save'){
    const f = state.fam = state.fam || {}; famRead(f);
    f.birth = $('fam-birth').value || ''; if($('fam-child')) f.child = $('fam-child').value || ''; f.weeks = +$('fam-weeks').value || 17;
    const b = String($('fam-base').value).trim(); f.base = b ? (parseFloat(/,/.test(b) ? b.replace(/\./g,'').replace(',','.') : b) || null) : null;
    save(); renderFam(); return;
  }
});

// ---------- day detail: legs as cards + key numbers as tiles; the long EASA text folds away ----------
function dayDetailTop(d, next){
  const base = state.settings.base || 'PMI';
  let out = '';
  if(d.legs.length){
    out += `<div class="dsec"><div class="dh"><span>${t('dx_flights')}</span><button type="button" data-mapday="${d.date}">🗺 ${t('map_btn')}</button></div><div class="dlegs">${d.legs.map(l => {
      const a = utcAt(d.date, l.t1); let b = utcAt(d.date, l.t2); if(+l.t2 < +l.t1) b += 864e5;
      const bl = (b - a) / 36e5;
      return `<div class="dleg${l.type==='dh'?' dh':''}"><span class="ap"><b>${l.dep}</b><small>${localHM(a, l.dep)}</small></span>
        <span class="mid"><span class="fn">${l.type==='dh'?'DH ':''}${esc(l.flight)}</span><span class="ln"></span><span>${hhmm(bl)} h</span></span>
        <span class="ap r"><b>${l.arr}</b><small>${localHM(b, l.arr)}</small></span></div>`; }).join('')}</div></div>`;
  }
  const tiles = [];
  const IC = {
    fdp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>',
    disc: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5"/><circle cx="12" cy="12" r="3"/></svg>',
    rest: '<svg viewBox="0 0 24 24"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M7 10V7"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    delay: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/><path d="M12 8v4l2.5 2.5"/></svg>' };
  const bar = (v, max, cls) => `<div class="dbar ${cls||''}"><i style="width:${Math.max(3, Math.min(100, v/max*100)).toFixed(0)}%"></i></div>`;
  const fh = fdpHtml(d, next), F = fh ? fdpHtml.last : null;
  if(F){
    const over = F.fdp > F.max;
    tiles.push(`<div class="dtile ${over ? 'bad' : 'ok'}"><div class="k">${IC.fdp}FDP</div><div class="v">${hhmm(F.fdp)}<small> / ${hhmm(F.max)}</small></div>${bar(F.fdp, F.max, over ? 'bad' : '')}<div class="s">${t('dx_fdpS', {n: F.sectors, st: esc(F.st)})}</div></div>`);
    tiles.push(`<div class="dtile"><div class="k">${IC.disc}${t('dx_disc')}</div><div class="v">${hhmm(F.disc)}<small> h</small></div>${bar(F.fdp, F.disc, 'soft')}<div class="s">${t('dx_discS', {t: F.discEnd})}</div></div>`);
  }
  const duties = allDuties(), i = (d.events||[]).some(e => e.type === 'ci') ? duties.findIndex(x => x.date === d.date) : -1;
  if(i >= 0 && duties[i].end){
    const x = duties[i], home = (x.endSt || base) === base && !x.hotel;
    const need = Math.max(x.end - x.start, (home ? 12 : 10) * 36e5), earliest = x.end + need, nx = duties[i+1], st = x.hotel || x.endSt || base;
    const got = nx ? nx.start - x.end : null;
    tiles.push(`<div class="dtile"><div class="k">${IC.rest}${t('dx_rest')}</div><div class="v">${hhmm(need/36e5)}<small> h</small></div><div class="s">${t('dx_restS', {d: localDay(earliest, st), t: localHM(earliest, st)})}</div></div>`);
    if(got != null) tiles.push(`<div class="dtile ${got < need ? 'bad' : 'ok'}"><div class="k">${IC.moon}${t('dx_got')}</div><div class="v">${got >= 36*36e5 ? durTxt(got).replace(/ 0 min$/, '') : hhmm(got/36e5) + '<small> h</small>'}</div>${bar(Math.min(got, need*1.5), need*1.5, got < need ? 'bad' : '')}<div class="s">${t('dx_gotS')}</div></div>`);
  }
  if(d.legs.length){
    const v = +d.delay || 0;
    tiles.push(`<div class="dtile wide drow"><div><div class="k">${IC.delay}${t('dx_delay')}</div><div class="s">${d.delay > 30 ? `<span class="pos">${t('dl_paid', {h: hhmm(d.delayPaid)})}</span>` : d.delay > 0 ? t('dl_notPaid') : t('dx_delayS')}</div></div>
      <div class="step"><button type="button" data-dstep="${d.date}" data-n="-5" aria-label="−5">−</button><input type="number" inputmode="numeric" min="0" step="5" data-delay="${d.date}" value="${v || ''}" placeholder="0"><span>min</span><button type="button" data-dstep="${d.date}" data-n="5" aria-label="+5">+</button></div></div>`);
  }
  if(tiles.length) out += `<div class="dtiles">${tiles.join('')}</div>`;
  const more = (fh || '') + (i >= 0 ? restHtml(d) : '');
  if(more) out += `<details class="how"><summary>${t('dx_easa')}</summary>${more}</details>`;
  return out;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-dstep]'); if(!b) return;
  const k = b.dataset.dstep, x = state.extras[k] = state.extras[k] || {}, v = Math.max(0, (+x.delay || 0) + (+b.dataset.n));
  if(v > 0) x.delay = v; else delete x.delay;
  save(); render();
});

// ---------- duty card: quick-action panels + long-press menu ----------
document.addEventListener('click', e => {
  const q = e.target.closest('[data-qp]');
  if(q){ const card = q.closest('.today') || document, k = q.dataset.qp, p = card.querySelector(`[data-qpanel="${k}"]`); if(!p) return;
    const open = p.hidden; card.querySelectorAll('[data-qpanel]').forEach(x => x.hidden = true); card.querySelectorAll('[data-qp]').forEach(x => x.classList.remove('on'));
    if(open){ p.hidden = false; q.classList.add('on'); if(k === 'lay'){ const dd = p.querySelector('details.td-lay'); if(dd) dd.open = true; } }
    return; }
  if(e.target.closest('[data-qsheet]')){ dutySheet(); return; }
  const sa = e.target.closest('[data-sa]');
  if(sa){ const k = sa.dataset.sa; closeSheet();
    const card = $('today'), date = card && card.dataset.date;
    if(k === 'mm'){ const b = $('td-mm'); if(b) b.click(); }
    else if(k === 'day' && date){ const w = document.createElement('span'); w.dataset.wk = date; document.body.appendChild(w); w.click(); w.remove(); }
    else if(k === 'cal'){ toolOpen = null; openTool('cal'); }
    else if(k === 'lay' || k === 'rest' || k === 'crew'){ const b = card && card.querySelector(`[data-qp="${k}"]`); if(b){ b.click(); b.scrollIntoView({behavior:'smooth', block:'center'}); } }
    else if(k === 'share' || k === 'copy') shareDuty(k);
    return; }
  if(e.target.closest('.sheet-bg') || e.target.closest('.sh-x')) closeSheet();
});
function closeSheet(){ document.querySelectorAll('.sheet,.sheet-bg').forEach(x => x.remove()); }
function dutyText(){
  const duties = allDuties(), now = Date.now(), x = duties.find(d => d.end && d.end > now); if(!x) return '';
  const st = x.st || state.settings.base;
  const lines = [`${localDay(x.start, st)} · ${x.route || kind(x.kind).n}`];
  const pk = pickupMs(x.date, x.d.events, x.start); if(pk) lines.push(`🚐 ${localHM(pk, st)}`);
  lines.push(`✓ ${t('td_ci')} ${localHM(x.start, st)} (${st})`);
  (x.d.legs||[]).filter(l => l.t1 && l.t2).forEach(l => { const a = utcAt(x.date, l.t1), b = legEnd(x.date, l); lines.push(`✈ ${l.flight} ${l.dep} ${localHM(a, l.dep)} → ${l.arr} ${localHM(b, l.arr)}`); });
  if(x.end) lines.push(`🏁 ${t('td_co')} ${localHM(x.end, x.endSt || st)}`);
  if(x.hotel) lines.push('🏨 ' + t('nightIn', {st: x.hotel}));
  return lines.join('\n');
}
async function shareDuty(k){
  const txt = dutyText(); if(!txt) return;
  try{ if(k === 'share' && navigator.share){ await navigator.share({ text: txt }); return; } }catch(e){ if(e && e.name === 'AbortError') return; }
  try{ await navigator.clipboard.writeText(txt); toastMsg(t('qa_copied')); }catch(e){}
}
function toastMsg(m){ let el = $('toast'); if(!el){ el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); } el.textContent = m; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1800); }
function dutySheet(){
  closeSheet();
  const card = $('today'); if(!card || card.hidden) return;
  const has = k => !!card.querySelector(k);
  const items = [
    has('#td-mm') ? ['mm','🛰', t('qa_mm')] : null,
    ['day','📋', t('qa_dayFull')],
    has('[data-qp="crew"]') ? ['crew','👥', t('crewT')] : null,
    has('[data-qp="lay"]') ? ['lay','🏨', t('qa_lay')] : null,
    has('[data-qp="rest"]') ? ['rest','🛏', t('dx_rest')] : null,
    ['share','📤', t('qa_share')], ['copy','📄', t('qa_copy')], ['cal','📅', t('qa_cal')] ].filter(Boolean);
  const route = (card.querySelector('.td-route') || {}).textContent || '';
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'menu');
  sh.innerHTML = `<div class="sh-t">${esc(route)}<small>${esc((card.querySelector('.td-route + .note') || {}).textContent || '')}</small></div>` +
    items.map(([k, ic, lb]) => `<button type="button" data-sa="${k}" role="menuitem">${qIcon(k)}${lb}</button>`).join('') +
    `<button type="button" class="sh-x">${t('close')}</button>`;
  document.body.append(bg, sh);
  try{ navigator.vibrate && navigator.vibrate(10); }catch(e){}
}
// long press anywhere on the duty card (not on a button) opens the menu
(function(){
  let tm = null, sx = 0, sy = 0;
  document.addEventListener('touchstart', e => {
    const c = e.target.closest('#today'); if(!c || e.target.closest('button,a,input,select,textarea,summary,.stubs,svg.sky-arc')) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    tm = setTimeout(() => { tm = null; dutySheet(); }, 520);
  }, {passive: true});
  document.addEventListener('touchmove', e => { if(tm && (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8)){ clearTimeout(tm); tm = null; } }, {passive: true});
  ['touchend','touchcancel'].forEach(ev => document.addEventListener(ev, () => { if(tm){ clearTimeout(tm); tm = null; } }, {passive: true}));
  document.addEventListener('contextmenu', e => { if(e.target.closest('#today')){ e.preventDefault(); dutySheet(); } });
})();

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-tddly]'); if(!b) return;
  const d = b.dataset.d, v = +b.dataset.tddly, ex = state.extras[d] = state.extras[d] || {};
  ex.delay = v ? (+ex.delay || 0) + v : 0; save();
  for(const k of Object.keys(state.months)) dutyCache.delete(state.months[k]);
  if(typeof render === 'function') render(); else renderToday();
});
