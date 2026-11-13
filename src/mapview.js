// ---- Route map and in-flight moving map (offline: country outlines + airports are inside the app) ----

const MAP = (() => {
  const merc = lat => Math.log(Math.tan(Math.PI/4 + Math.max(-80, Math.min(80, lat)) * Math.PI/360)) * 180/Math.PI;
  const P = (lon, lat) => [lon, -merc(lat)];
  let countries = null, pathAll = '';
  function load(){
    if(countries) return;
    countries = MAP_RAW.split('|').map(c => { const i = c.indexOf(':');
      return { cc: c.slice(0, i), rings: c.slice(i+1).split('/').map(r => r.split(' ').map(p => p.split(',').map(Number))) }; });
    pathAll = countries.map(c => c.rings.map(r => 'M' + r.map(([x,y]) => P(x,y).map(v => v.toFixed(2)).join(',')).join('L') + 'Z').join('')).join('');
  }
  // great circle between two airports, as projected points
  function arc(a, b, n){
    const r = Math.PI/180, A = AP[a], B = AP[b]; if(!A || !B) return [];
    const p1 = [A.lat*r, A.lon*r], p2 = [B.lat*r, B.lon*r];
    const v = ([la, lo]) => [Math.cos(la)*Math.cos(lo), Math.cos(la)*Math.sin(lo), Math.sin(la)];
    const u1 = v(p1), u2 = v(p2), d = Math.acos(Math.min(1, u1[0]*u2[0] + u1[1]*u2[1] + u1[2]*u2[2]));
    const out = [];
    for(let i = 0; i <= (n||32); i++){
      const f = i/(n||32), s = d ? Math.sin(d) : 1, k1 = d ? Math.sin((1-f)*d)/s : 1-f, k2 = d ? Math.sin(f*d)/s : f;
      const x = k1*u1[0] + k2*u2[0], y = k1*u1[1] + k2*u2[1], z = k1*u1[2] + k2*u2[2];
      out.push([Math.atan2(y, x)/r, Math.atan2(z, Math.hypot(x, y))/r]);
    }
    return out;
  }
  function countryAt(lat, lon){
    load();
    for(const c of countries) for(const ring of c.rings){
      let inside = false;
      for(let i = 0, j = ring.length - 1; i < ring.length; j = i++){
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if(((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
      }
      if(inside) return c.cc;
    }
    return null;
  }
  // svg: legs = [{dep, arr, n}], plane = {lat, lon, hdg}
  // airliner seen from above (nose up), in a 100×100 box centred on 0,0
  const AC = `<symbol id="ac" viewBox="-50 -50 100 100" overflow="visible">
    <g transform="translate(2.5 3)" fill="#000" opacity=".28"><path d="M0-46c2.6 0 4.3 3 4.3 8v22.5L46 6.5v5L4.3 1.5V30l11 8v4.5L1.3 39H-1.3l-14 3.5V38l11-8V1.5L-46 11.5v-5l41.7-22V-38c0-5 1.7-8 4.3-8z"/></g>
    <path d="M0-46c2.6 0 4.3 3 4.3 8v22.5L46 6.5v5L4.3 1.5V30l11 8v4.5L1.3 39H-1.3l-14 3.5V38l11-8V1.5L-46 11.5v-5l41.7-22V-38c0-5 1.7-8 4.3-8z" fill="url(#acg)" stroke="var(--ac-edge)" stroke-width="1.4"/>
    <rect x="13" y="-4.5" width="5" height="12" rx="2.3" fill="url(#eng)" stroke="#1b2333" stroke-width=".6"/>
    <rect x="-18" y="-4.5" width="5" height="12" rx="2.3" fill="url(#eng)" stroke="#1b2333" stroke-width=".6"/>
    <path d="M-1.6-40h3.2v66h-3.2z" fill="#fff" opacity=".5"/>
    <path d="M-2.6-41.5c.8-1.6 4.4-1.6 5.2 0l-.6 2h-4z" fill="#22344f"/>
  </symbol>
  <linearGradient id="acg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--pay)"/><stop offset=".5" stop-color="var(--ac-hi)"/><stop offset="1" stop-color="var(--pay)"/></linearGradient>
  <linearGradient id="eng" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d97a8"/><stop offset=".5" stop-color="#e9edf3"/><stop offset="1" stop-color="#7d8798"/></linearGradient>
  <radialGradient id="seag" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="var(--map-sea2)"/><stop offset="1" stop-color="var(--map-sea)"/></radialGradient>`;
  function bounds(legs, opt){
    if(opt.view){ const { cx, cy, w } = opt.view, h = w * 3/4; return [cx - w/2, cy - h/2, cx + w/2, cy + h/2]; }
    const pts = [];
    legs.forEach(l => [l.dep, l.arr].forEach(a => AP[a] && pts.push(P(AP[a].lon, AP[a].lat))));
    if(opt.plane) pts.push(P(opt.plane.lon, opt.plane.lat));
    if(!pts.length) pts.push(P(2.7, 39.5));
    let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
    // the moving map is tilted in 3D: leave more room so both airports stay on screen
    const f = opt.done != null ? 0.3 : 0.12, pad = Math.max(2.2, (x1 - x0) * f, (y1 - y0) * f);
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const w = x1 - x0, h = y1 - y0, want = 4/3;
    if(w/h < want){ const e = (h*want - w)/2; x0 -= e; x1 += e; } else { const e = (w/want - h)/2; y0 -= e; y1 += e; }
    return [x0, y0, x1, y1];
  }
  const pathOf = pts => 'M' + pts.map(([lo, la]) => P(lo, la).map(v => v.toFixed(3)).join(',')).join('L');
  // svg: legs = [{dep, arr, n, dh}], opt = {plane: {lat, lon, hdg}, done: 0..1 (part of the single leg flown), view, id}
  function svg(legs, opt){
    load(); opt = opt || {};
    const [x0, y0, x1, y1] = bounds(legs, opt), k = (x1 - x0) / 100;
    const max = Math.max(...legs.map(l => l.n || 1), 1);
    // graticule every 5°
    let grat = '';
    for(let lo = -30; lo <= 60; lo += 5) grat += `M${lo},${-merc(72)}L${lo},${-merc(14)}`;
    for(let la = 15; la <= 70; la += 5) grat += `M-32,${(-merc(la)).toFixed(3)}L62,${(-merc(la)).toFixed(3)}`;
    const lines = legs.map(l => { const a = arc(l.dep, l.arr, 96); if(!a.length) return '';
      const w = 1.6 + 2.6 * (l.n||1) / max;
      if(opt.done == null) return `<path d="${pathOf(a)}" class="m-glow" style="stroke-width:${w + 5}px"/><path d="${pathOf(a)}" class="m-leg${l.dh?' m-dh':''}" style="stroke-width:${w}px"/>`;
      const cut = Math.max(0, Math.min(96, Math.round(opt.done * 96)));
      return `<path d="${pathOf(a)}" class="m-todo"/><path id="mm-done" d="${pathOf(a.slice(0, cut + 1))}" class="m-leg" style="stroke-width:3.5px"/>`; }).join('')
      + (opt.tracks || []).filter(tr => tr.length > 1).map(tr => `<path d="${pathOf(tr.map(p => [p[1], p[0]]))}" class="m-trk"/>`).join('');
    const aps = [...new Set(legs.flatMap(l => [l.dep, l.arr]))].filter(a => AP[a]);
    const dots = aps.map(a => { const [x, y] = P(AP[a].lon, AP[a].lat);
      return `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${(k*1.5).toFixed(3)}" class="m-apo"/><circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${(k*0.75).toFixed(3)}" class="m-ap"/>
        <text x="${(x + k*2).toFixed(3)}" y="${(y + k*1.1).toFixed(3)}" style="font-size:${(k*3.6).toFixed(3)}px" class="m-lbl">${a}</text>`; }).join('');
    let plane = '';
    if(opt.plane){ const [x, y] = P(opt.plane.lon, opt.plane.lat), sz = k * 13;
      plane = `<g id="mm-plane" transform="translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${(opt.plane.hdg||0).toFixed(1)})"><use href="#ac" x="${(-sz/2).toFixed(3)}" y="${(-sz/2).toFixed(3)}" width="${sz.toFixed(3)}" height="${sz.toFixed(3)}"/></g>`; }
    return `<svg class="mapsvg"${opt.id ? ` id="${opt.id}"` : ''} viewBox="${x0.toFixed(3)} ${y0.toFixed(3)} ${(x1-x0).toFixed(3)} ${(y1-y0).toFixed(3)}" role="img" aria-label="map"><defs>${AC}</defs>
      <filter id="relief" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="${(k*0.35).toFixed(3)}" stdDeviation="${(k*0.35).toFixed(3)}" flood-color="#000" flood-opacity=".45"/></filter>
      <rect x="-40" y="-120" width="110" height="120" fill="url(#seag)"/><path d="${grat}" class="m-grat"/><path d="${pathAll}" class="m-land" filter="url(#relief)"/>${lines}${dots}${plane}</svg>`;
  }
  // move the plane on an svg made by svg() without redrawing the map
  function place(el, legs, opt){
    const [x0, y0, x1, y1] = bounds(legs, opt), k = (x1 - x0) / 100;
    el.setAttribute('viewBox', `${x0.toFixed(3)} ${y0.toFixed(3)} ${(x1-x0).toFixed(3)} ${(y1-y0).toFixed(3)}`);
    const g = el.querySelector('#mm-plane'), [x, y] = P(opt.plane.lon, opt.plane.lat), sz = k * 13;
    if(g){ g.setAttribute('transform', `translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${(opt.plane.hdg||0).toFixed(1)})`);
      const u = g.querySelector('use'); u.setAttribute('x', -sz/2); u.setAttribute('y', -sz/2); u.setAttribute('width', sz); u.setAttribute('height', sz); }
    const d = el.querySelector('#mm-done');
    if(d && legs[0]){ const a = arc(legs[0].dep, legs[0].arr, 96), cut = Math.max(0, Math.min(96, Math.round((opt.done||0) * 96))); d.setAttribute('d', pathOf(a.slice(0, cut + 1))); }
  }
  const proj = P;
  return { svg, arc, countryAt, place, proj };
})();

// ---------- map tool ----------
let mapDay = null, mapMonth = null, mm = null;   // mapMonth: a month key or 'all'; mm = moving map state
function monthLegs(ro, onlyDate){
  const c = PR.compute(ro, state.settings, state.extras), seen = {};
  for(const d of c.days){
    if(onlyDate && d.date !== onlyDate) continue;
    for(const l of d.legs){ const k = l.dep + '-' + l.arr + (l.type==='dh'?'*':''); seen[k] = seen[k] || { dep:l.dep, arr:l.arr, n:0, dh: l.type==='dh' }; seen[k].n++; }
  }
  return Object.values(seen);
}
function renderMap(){
  const ro = state.months[state.current];
  if(!ro){ pnl(hdr('map') + `<p class="msg">${t('startText')}</p>`); return; }
  if(mm){ renderMoving(); return; }
  // period: one saved month or all of them; inside a month, one day
  const mks = Object.keys(state.months).sort().reverse();
  const mk = mapMonth === 'all' ? 'all' : (mapMonth && state.months[mapMonth] ? mapMonth : state.current);
  const allTime = mk === 'all', rm = allTime ? null : state.months[mk];
  const flDays = rm ? PR.compute(rm, state.settings, state.extras).days.filter(d => d.legs.length) : [];
  const sel = mapDay && flDays.some(d => d.date === mapDay) ? mapDay : '';
  let legs;
  if(allTime){ const seen = {};
    for(const k of mks) for(const l of monthLegs(state.months[k])){ const id = l.dep + '-' + l.arr + (l.dh ? '*' : ''); if(seen[id]) seen[id].n += l.n; else seen[id] = Object.assign({}, l); }
    legs = Object.values(seen); }
  else legs = monthLegs(rm, sel || null);
  const km = legs.reduce((a, l) => a + kmBetween(l.dep, l.arr) * (l.dh ? 0 : l.n), 0);
  const mOpts = `<option value="all"${allTime ? ' selected' : ''}>${t('map_allTime')}</option>` + mks.map(k => { const [y, m] = k.split('-').map(Number);
    return `<option value="${k}"${k === mk ? ' selected' : ''}>${monthName(y, m, {month:'long', year:'numeric'})}</option>`; }).join('');
  const dOpts = rm ? `<option value="">${t('map_all',{m:monthName(rm.year, rm.month)})}</option>` + flDays.map(d => `<option value="${d.date}"${d.date===sel?' selected':''}>${d.day} · ${esc(d.route)}</option>`).join('') : '';
  const missing = [...new Set(legs.flatMap(l => [l.dep, l.arr]))].filter(a => !AP[a]);
  const trk = allTime ? Object.values(state.tracks || {}).filter(tr => tr.pts.length > 1).sort((a, b) => a.date.localeCompare(b.date))
    : tracksOf(new Set(sel ? [sel] : rm.days.map(d => d.date)));
  mapDispose();
  const use3d = !mapFlat && /^https?:/.test(location.protocol);
  const flatBox = `<div class="mapbox">${MAP.svg(legs, {tracks: trk.map(tr => tr.pts)})}${/^https?:/.test(location.protocol) ? `<div class="mm-btns"><button class="mm-zoom" id="map-3d" type="button">🌍 3D</button></div>` : ''}</div>`;
  const box3d = `<div class="mapbox g3box"><div id="g3m" class="g3d"></div><div class="g3-load note" id="g3m-load">${t('g3_loading')}</div>
      <div class="mm-btns"><button class="mm-zoom" id="map-2d" type="button">🗺 2D</button></div></div>`;
  pnl(hdr('map', t('map_intro')) + `<div class="row mapsel"><label class="note">${t('map_show')} <select id="map-m">${mOpts}</select></label>
    ${rm ? `<label class="note"><select id="map-d" aria-label="${esc(t('map_show'))}">${dOpts}</select></label>` : ''}</div>
    ${use3d ? box3d : flatBox}
    <p class="note">${t('map_stats', {n: legs.filter(l=>!l.dh).reduce((a,l)=>a+l.n,0), k: Math.round(km).toLocaleString(LOC)})}${missing.length ? ' · ' + t('map_noAp',{a: missing.join(', ')}) : ''}</p>
    <div class="row"><button class="btn" id="mm-go" type="button">✈ ${t('mm_start')}</button></div>
    <p class="note">${t('mm_note')}</p>${tracksHtml(trk)}`);
  if(use3d) mapStart3d(legs, trk.map(tr => tr.pts));
}
// the route map on the 3D globe; the flat map stays as the fallback and as a choice
let mapG3 = null, mapG3tok = null, mapFlat = false;
function mapDispose(){ mapG3tok = null; if(mapG3){ try{ mapG3.dispose(); }catch(e){} mapG3 = null; } }
async function mapStart3d(legs, tracks){
  const tok = mapG3tok = {};
  try{
    if(!window.THREE) await loadScript('lib/three.min.js');
    const box = $('g3m'); if(!box || mapG3tok !== tok || box.querySelector('canvas')) return;
    const cv = document.createElement('canvas'); if(!(cv.getContext('webgl2') || cv.getContext('webgl'))) throw new Error('no webgl');
    mapG3 = Globe3D(box); mapG3.setRoutes(legs, tracks);
    const ld = $('g3m-load'); if(ld) ld.remove();
  }catch(e){ console.warn('map 3d', e); if(mapG3tok === tok){ mapFlat = true; renderMap(); } }
}
document.addEventListener('click', e => {
  if(e.target.id === 'map-2d'){ mapFlat = true; renderMap(); }
  else if(e.target.id === 'map-3d'){ mapFlat = false; renderMap(); }
});

// ---------- moving map ----------
function pickLeg(){
  // the leg flying now, or the next one, from all saved months
  const now = Date.now(), all = allLegs();
  return all.find(l => l.end > now - 30*60e3) || all[all.length-1] || null;
}
function allLegs(){
  const all = [];
  for(const k of Object.keys(state.months).sort()){
    const c = PR.compute(state.months[k], state.settings, state.extras);
    for(const d of c.days) for(const l of d.legs){ if(!l.t1 || !l.t2) continue;
      // a delay entered for the day moves the legs: the plane must not "take off" while we are still on the ground
      const dly = Math.max(0, +((state.extras[d.date]||{}).delay) || 0) * 60e3;
      const a = utcAt(d.date, l.t1) + dly; let b = utcAt(d.date, l.t2) + dly; if(b < a) b += 864e5;
      all.push({ ...l, date: d.date, start: a, end: b, dly: dly / 60e3 }); }
  }
  return all.filter(l => l.type === 'flt' || l.type === 'dh');   // deadheads too: we fly them as well
}
function startMoving(){
  mapDispose();
  const leg = pickLeg();
  if(!leg || !AP[leg.dep] || !AP[leg.arr]){ $('toolPanel').insertAdjacentHTML('beforeend', `<p class="msg err">${t('mm_noLeg')}</p>`); return; }
  mm = { leg, fix: null, err: null, track: [], sim: 0 };
  mm.dayLegs = allLegs().filter(l => l.date === leg.date);
  if(navigator.geolocation) mm.watch = navigator.geolocation.watchPosition(p => {
    const prev = mm && mm.fix;
    mm.fix = { lat: p.coords.latitude, lon: p.coords.longitude, alt: p.coords.altitude, spd: p.coords.speed, hdg: p.coords.heading, acc: p.coords.accuracy, at: p.timestamp };
    // heading/speed from the last fix when the phone doesn't give them
    if(prev && (mm.fix.hdg == null || isNaN(mm.fix.hdg) || mm.fix.spd == null)){
      const dt = (mm.fix.at - prev.at) / 1000, dkm = kmLL(prev.lat, prev.lon, mm.fix.lat, mm.fix.lon);
      if(dt >= 3 && mm.fix.spd == null) mm.fix.spd = dkm * 1000 / dt;
      if(mm.fix.hdg == null || isNaN(mm.fix.hdg)) mm.fix.hdg = bearing(prev.lat, prev.lon, mm.fix.lat, mm.fix.lon);
    }
    mm.track.push([mm.fix.lat, mm.fix.lon]); if(mm.track.length > 500) mm.track.shift();
    try{ trackAdd(mm.leg, mm.fix); }catch(err){}
    mm.err = null; if(toolOpen === 'map') renderMoving();
  }, e => { if(!mm) return; mm.err = e.code === 1 ? 'denied' : 'wait'; },
  { enableHighAccuracy: true, maximumAge: 5000, timeout: 60000 });
  try{ navigator.wakeLock && navigator.wakeLock.request('screen').then(l => { if(mm) mm.lock = l; }).catch(()=>{}); }catch(e){}
  renderMoving();
}
function stopMoving(){
  if(!mm) return;
  try{ navigator.geolocation.clearWatch(mm.watch); }catch(e){}
  try{ trackSave(); }catch(e){}
  try{ mm.lock && mm.lock.release(); }catch(e){}
  try{ mm.g3 && mm.g3.dispose(); }catch(e){}
  mm = null; renderMap();
}
function kmLL(la1, lo1, la2, lo2){ const r = Math.PI/180, h = Math.sin((la2-la1)*r/2)**2 + Math.cos(la1*r)*Math.cos(la2*r)*Math.sin((lo2-lo1)*r/2)**2; return 2*6371*Math.asin(Math.sqrt(h)); }
function bearing(la1, lo1, la2, lo2){ const r = Math.PI/180, y = Math.sin((lo2-lo1)*r)*Math.cos(la2*r), x = Math.cos(la1*r)*Math.sin(la2*r) - Math.sin(la1*r)*Math.cos(la2*r)*Math.cos((lo2-lo1)*r); return (Math.atan2(y, x)/r + 360) % 360; }
// Position without GPS: along the great circle by the schedule (10 min taxi each end), with a simple climb/descent profile.
function flightProfile(L, p){
  const A = AP[L.dep], B = AP[L.arr], total = kmLL(A.lat, A.lon, B.lat, B.lon);
  p = Math.max(0, Math.min(1, p));
  const pts = MAP.arc(L.dep, L.arr, 200), i = Math.min(199, Math.floor(p * 200)), f = p * 200 - i;
  const [lo1, la1] = pts[i], [lo2, la2] = pts[i+1];
  const lat = la1 + (la2-la1)*f, lon = lo1 + (lo2-lo1)*f;
  const cruise = Math.min(38000, 14000 + total * 30), dKm = p * total, leftKm = total - dKm;
  const climbKm = Math.min(total * 0.4, 190), descKm = Math.min(total * 0.45, 230);
  const alt = p <= 0 || p >= 1 ? 0 : dKm < climbKm ? cruise * dKm / climbKm : leftKm < descKm ? cruise * leftKm / descKm : cruise;
  const kt = p <= 0 || p >= 1 ? 0 : 160 + (Math.min(460, 300 + total * 0.12) - 160) * Math.min(1, alt / cruise);
  return { lat, lon, alt: alt / 3.28084, spd: kt / 1.94384, hdg: bearing(la1, lo1, la2, lo2) };
}
// moves from the scheduled departure (off-block) to the scheduled arrival (on-block)
function schedProgress(L, now){
  return L.end > L.start ? (now - L.start) / (L.end - L.start) : 0;
}
let mmTimer = null;
async function start3d(L, plane, done, now){
  try{
    if(mm.g3){ mm.g3.dispose(); mm.g3 = null; }
    const tok = mm.g3tok = {};
    if(!window.THREE) await loadScript('lib/three.min.js');
    const box = $('g3d'); if(!box || !mm || mm.g3tok !== tok || box.querySelector('canvas')) return;
    const cv = document.createElement('canvas'); if(!(cv.getContext('webgl2') || cv.getContext('webgl'))) throw new Error('no webgl');
    mm.g3 = Globe3D(box);
    mm.g3.setRoute(L.dep, L.arr, [AP[L.dep].lat, AP[L.dep].lon], [AP[L.arr].lat, AP[L.arr].lon], AP[L.dep].city, AP[L.arr].city);
    if(mm.g3view) mm.g3.setView(mm.g3view);
    mm.g3.update(plane, done, now);
    const ld = $('g3-load'); if(ld) ld.remove();
  }catch(e){ console.warn('3d', e); if(mm){ mm.no3d = true; mm._key = null; renderMoving(); } }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-mmdly]'); if(!b || !mm) return;
  const v = +b.dataset.mmdly, ex = state.extras[mm.leg.date] = state.extras[mm.leg.date] || {};
  ex.delay = v ? (+ex.delay || 0) + v : 0; save();
  const st = mm.leg.start - (mm.leg.dly||0)*60e3;
  mm.dayLegs = allLegs().filter(l => l.date === mm.leg.date);
  mm.leg = mm.dayLegs.find(l => l.flight === mm.leg.flight && l.dep === mm.leg.dep) || mm.leg; mm._key = null; renderMoving();
});
function renderMoving(){
  let now = Date.now();
  // when a leg is over (and there is no live GPS), go on to the next leg of the day by itself
  if(!mm.sim && !mm.pinned && now > mm.leg.end + 5*60e3 && !(mm.fix && now - mm.fix.at < 120000)){
    const nx = (mm.dayLegs||[]).find(l => l.start > mm.leg.start); if(nx) mm.leg = nx;
  }
  const L = mm.leg, A = AP[L.dep], B = AP[L.arr];
  const total = kmLL(A.lat, A.lon, B.lat, B.lon);
  // where the plane is: simulation, a fresh GPS fix (< 2 min), or the schedule
  let src, f, eta = null;
  if(mm.sim){
    const p = ((now - mm.sim) / 45000) % 1.08;
    f = flightProfile(L, p / 1.0); src = 'sim';
    eta = now + (1 - Math.min(1, p)) * 45000;
  } else if(mm.fix && now - mm.fix.at < 120000){ f = mm.fix; src = 'gps';
    mm.ground = (f.spd == null || f.spd < 40) && (f.alt == null || f.alt < 400); }
  else { f = flightProfile(L, schedProgress(L, now)); src = 'est'; eta = L.end; }
  const left = kmLL(f.lat, f.lon, B.lat, B.lon), done = Math.max(0, Math.min(100, 100 * (1 - left / total)));
  const kts = f.spd != null ? f.spd * 1.94384 : null, kmh = f.spd != null ? f.spd * 3.6 : null;
  if(src === 'gps') eta = kmh && kmh > 150 ? now + left / kmh * 36e5 : null;
  const cc = MAP.countryAt(f.lat, f.lon);
  let land = cc;
  try{ if(cc) land = new Intl.DisplayNames([LOC], {type:'region'}).of(cc); }catch(e){}
  const st = (v, l) => `<div class="mm-st"><div class="mm-v">${v}</div><div class="note">${l}</div></div>`;
  const badge = src === 'gps' ? `<span class="chip c-vac">📡 ${t('mm_srcGps')}</span>` : src === 'sim' ? `<span class="chip c-bez">▶ ${t('mm_srcSim')}</span>` : `<span class="chip">🕒 ${t('mm_srcEst')}</span>`;
  let why = src === 'est' ? `<p class="note">${mm.err === 'denied' ? t('mm_denied') : t('mm_estWhy')}</p>` : '';
  if(src !== 'sim' && now < L.start) why = `<p class="msg">${t('mm_before', {h: localHM(L.start, L.dep), m: durTxt(L.start - now)})}</p>` + why;
  else if(src === 'gps' && mm.ground && done < 50) why = `<p class="msg">${t('mm_ground', {a: L.dep})}</p>` + why;
  if(src !== 'sim' && now < L.end) why += `<div class="mm-dly"><span class="note">${L.dly ? t('mm_dlyOn', {m: L.dly}) : t('mm_dlyQ')}</span>${[15,30,60].map(v => `<button type="button" class="chip" data-mmdly="${v}">+${v}′</button>`).join('')}${L.dly ? `<button type="button" class="chip" data-mmdly="0">✕</button>` : ''}</div>`;
  else if(src === 'est' && now > L.end) why = `<p class="msg">${t('mm_after', {a: L.arr})}</p>` + why;
  const legs = mm.dayLegs || [];
  const legSel = legs.length > 1 ? `<select id="mm-leg">${legs.map((l, i) => `<option value="${i}"${l.flight===L.flight && l.dep===L.dep ? ' selected' : ''}>${esc(l.flight)} ${l.dep}–${l.arr} ${t4(l.t1)}Z</option>`).join('')}</select>` : '';
  const plane = { lat: f.lat, lon: f.lon, hdg: f.hdg != null && !isNaN(f.hdg) ? f.hdg : bearing(A.lat, A.lon, B.lat, B.lon) };
  const P0 = MAP.proj(f.lon, f.lat);
  const mopt = { plane, done: done / 100, id: 'mm-map', view: mm.follow ? { cx: P0[0], cy: P0[1], w: 5 } : null };
  const one = [{dep: L.dep, arr: L.arr, n: 1}];
  const stats = `
      ${st(kts != null ? Math.round(kts) + ' kt' : '—', t('mm_gs') + (kmh != null ? ` · ${Math.round(kmh)} km/h` : ''))}
      ${st(f.alt != null ? Math.round(f.alt * 3.28084 / 100) * 100 + ' ft' : '—', src === 'gps' ? t('mm_alt') : t('mm_altEst'))}
      ${st(Math.round(left) + ' km', t('mm_left', {a: L.arr}))}
      ${st(eta ? (src === 'sim' ? Math.max(0, Math.round((eta - now)/1000)) + ' s' : localHM(eta, L.arr)) : '—', t('mm_eta', {a: L.arr}))}
      ${st(Math.round(done) + ' %', t('mm_done'))}
      ${st(land ? esc(land) : t('mm_sea'), t('mm_over'))}`;
  const fix = src === 'gps' ? t('mm_fix', {s: Math.round((now - f.at) / 1000), a: Math.round(f.acc || 0)}) : '';
  if(mm.tilt == null) mm.tilt = true;
  // 3D globe (three.js, in the app); the flat map is the fallback
  const use3d = !mm.no3d && /^https?:/.test(location.protocol);
  const key = [L.flight, L.dep, L.start, !!mm.follow, !!mm.sim, !!mm.tilt, lang, use3d].join('|');
  const el = use3d ? $('g3d') : $('mm-map');
  if(el && mm._key === key){
    // only move the plane and refresh the numbers: the map itself stays
    if(use3d){ if(mm.g3) mm.g3.update(plane, done / 100, now); }
    else MAP.place(el, one, mopt);
    const put = (id, h) => { const x = $(id); if(x && x._h !== h){ x._h = h; x.innerHTML = h; } };
    put('mm-badge', badge); put('mm-why', why); put('mm-stats', stats); $('mm-fix').textContent = fix;
  } else {
    mm._key = key;
    pnl(hdr('map') + `<div class="mm-head"><b>${esc(L.flight)}</b> ${L.dep} → ${L.arr} · ${t4(L.t1)}–${t4(L.t2)} UTC · ${Math.round(total)} km</div>
      <div class="row" style="align-items:center;gap:8px;margin:4px 0"><span id="mm-badge">${badge}</span>${legSel}</div>
      ${use3d ? `<div class="mapbox g3box"><div id="g3d" class="g3d"></div><div class="g3-load note" id="g3-load">${t('g3_loading')}</div>
        <div class="mm-btns"><button class="mm-zoom${mm.g3view !== 'near' ? ' on' : ''}" id="g3-globe" type="button">🌍 ${t('g3_globe')}</button><button class="mm-zoom${mm.g3view === 'near' ? ' on' : ''}" id="g3-near" type="button">✈ ${t('g3_near')}</button></div></div>` :
      `<div class="mapbox mm-box${mm.tilt ? ' tilt' : ''}">${MAP.svg(one, mopt)}
        <div class="mm-btns"><button class="mm-zoom" id="mm-follow" type="button">${mm.follow ? '🗺 ' + t('mm_route') : '🎯 ' + t('mm_follow')}</button></div></div>`}
      <div id="mm-why">${why}</div>
      <div class="mm-grid" id="mm-stats">${stats}</div>
      <p class="note" id="mm-fix">${fix}</p>
      <div class="row"><button class="btn${mm.sim ? '' : ' ghost'}" id="mm-sim" type="button">${mm.sim ? '■ ' + t('mm_simStop') : '▶ ' + t('mm_sim')}</button>
        <button class="btn ghost" id="mm-stop" type="button">${t('mm_stop')}</button></div>
      <p class="note">${t('mm_note')}</p><p class="note">${t('mm_tips')}</p>`);
    if(use3d) start3d(L, plane, done / 100, now);
  }
  clearInterval(mmTimer);
  mmTimer = setInterval(() => { if(!mm || toolOpen !== 'map'){ clearInterval(mmTimer); if(mm && mm.g3){ mm.g3.dispose(); mm.g3 = null; } return; } renderMoving(); }, mm.sim ? 200 : (use3d ? 2000 : 5000));
}
document.addEventListener('change', e => { if(e.target.id === 'map-d'){ mapDay = e.target.value || null; renderMap(); }
  if(e.target.id === 'map-m'){ mapMonth = e.target.value; mapDay = null; renderMap(); }
  if(e.target.id === 'mm-leg' && mm){ mm.leg = mm.dayLegs[+e.target.value]; mm.sim = 0; mm.pinned = true; renderMoving(); } });
document.addEventListener('click', e => {
  const id = e.target.id;
  if(id === 'mm-go'){ startMoving(); return; }
  if(id === 'td-mm' || e.target.closest && e.target.closest('#td-mm')){ toolOpen = null; openTool('map'); if(!mm) startMoving(); $('toolPanel').scrollIntoView({block:'start'}); return; }
  if(id === 'mm-stop'){ clearInterval(mmTimer); stopMoving(); return; }
  if(id === 'mm-sim' && mm){ mm.sim = mm.sim ? 0 : Date.now(); renderMoving(); return; }
  if(id === 'mm-follow' && mm){ mm.follow = !mm.follow; renderMoving(); return; }
  if((id === 'g3-globe' || id === 'g3-near') && mm){ mm.g3view = id === 'g3-near' ? 'near' : 'globe'; if(mm.g3) mm.g3.setView(mm.g3view);
    $('g3-globe').classList.toggle('on', mm.g3view === 'globe'); $('g3-near').classList.toggle('on', mm.g3view === 'near'); return; }
  const md = e.target.closest('[data-mapday]'); if(md){ mapDay = md.dataset.mapday; mapMonth = mapDay.slice(0, 7); toolOpen = null; openTool('map'); return; }
});

// ---- Payroster+ (Nov 2026): GPS trace, layovers, month so far, swap with a colleague, install, settings by QR ----

// ---------- GPS trace of the moving map ----------
// Fixes are kept per flight while the moving map runs with GPS, thinned to one point every
// 30 s or 5 km, so a sector is about 10 kB. The 25 newest flights are kept, under 500 kB in all,
// so the traces never crowd the rosters out of local storage.
let trkDirty = 0, trkSavedAt = 0;
const trkKey = l => l.date + '|' + l.flight;
function trackAdd(leg, f){
  if(!leg || !f || !(f.acc < 3000)) return;
  const T = state.tracks = state.tracks || {}, k = trkKey(leg);
  const tr = T[k] = T[k] || { date: leg.date, flight: leg.flight, dep: leg.dep, arr: leg.arr, pts: [], alt: 0, spd: 0 };
  const last = tr.pts[tr.pts.length - 1], sec = Math.round(f.at / 1000);
  if(last && sec - last[3] < 30 && kmLL(last[0], last[1], f.lat, f.lon) < 5) return;
  tr.pts.push([+f.lat.toFixed(4), +f.lon.toFixed(4), f.alt != null ? Math.round(f.alt) : null, sec]);
  if(tr.pts.length > 800) tr.pts = tr.pts.filter((p, i, a) => i % 2 === 0 || i === a.length - 1);
  if(f.alt != null && f.alt > tr.alt) tr.alt = Math.round(f.alt);
  if(f.spd != null && f.spd < 340 && f.spd > tr.spd) tr.spd = Math.round(f.spd);   // < 340 m/s drops GPS glitches
  const ks = Object.keys(T).sort(); while(ks.length > 25) delete T[ks.shift()];
  trkDirty++;
  if(trkDirty >= 6 || Date.now() - trkSavedAt > 120e3) trackSave();
}
function trackSave(){
  if(!trkDirty) return; trkDirty = 0; trkSavedAt = Date.now();
  const T = state.tracks || {}, ks = Object.keys(T).sort();
  while(ks.length > 1 && JSON.stringify(T).length > 500e3) delete T[ks.shift()];
  save();
}
const trkKm = tr => tr.pts.reduce((a, p, i) => i ? a + kmLL(tr.pts[i-1][0], tr.pts[i-1][1], p[0], p[1]) : 0, 0);
function tracksOf(dates){ return Object.values(state.tracks || {}).filter(tr => tr.pts.length > 1 && dates.has(tr.date)).sort((a, b) => a.date.localeCompare(b.date)); }
function tracksHtml(list){
  if(!list.length) return `<p class="note">📡 ${t('trk_note')}</p>`;
  return `<h3 class="wh">📡 ${t('trk_title')}</h3><div class="mlist">${list.map(tr => {
    const d = new Date(tr.date + 'T12:00').toLocaleDateString(LOC, {weekday:'short', day:'numeric', month:'short'});
    const bits = [t('trk_line', {k: Math.round(trkKm(tr)).toLocaleString(LOC), n: tr.pts.length})];
    if(tr.alt) bits.push(t('trk_alt', {f: (Math.round(tr.alt * 3.28084 / 100) * 100).toLocaleString(LOC)}));
    if(tr.spd) bits.push(t('trk_spd', {k: Math.round(tr.spd * 1.94384)}));
    return `<div class="mrow"><div class="mh">${d} · <b>${esc(tr.flight)}</b> ${tr.dep} → ${tr.arr}</div>
      <div class="note trkrow"><span>${bits.join(' · ')}</span><button class="btn ghost sm" type="button" data-trkdel="${esc(trkKey(tr))}">${t('trk_del')}</button></div></div>`; }).join('')}</div>`;
}

// ---------- layovers: local time, currency, plug and my own notes per airport ----------
// [currency, plug types]; 230 V everywhere listed. Bulgaria uses the euro since 1 Jan 2026.
const CTRY = {
  AE:['AED','G'], AL:['ALL','C/F'], AM:['AMD','C/F'], AT:['EUR','C/F'], AZ:['AZN','C/F'], BA:['BAM','C/F'], BE:['EUR','C/E'], BG:['EUR','C/F'],
  BH:['BHD','G'], BY:['BYN','C/F'], CH:['CHF','C/J'], CV:['CVE','C/F'], CY:['EUR','G'], CZ:['CZK','C/E'], DE:['EUR','C/F'], DK:['DKK','C/E/F/K'],
  DZ:['DZD','C/F'], EE:['EUR','C/F'], EG:['EGP','C/F'], ES:['EUR','C/F'], FI:['EUR','C/F'], FR:['EUR','C/E'], GB:['GBP','G'], GE:['GEL','C/F'],
  GG:['GBP','G'], GR:['EUR','C/F'], HR:['EUR','C/F'], HU:['HUF','C/F'], IE:['EUR','G'], IL:['ILS','C/H'], IQ:['IQD','C/D/G'], IR:['IRR','C/F'],
  IS:['ISK','C/F'], IT:['EUR','C/F/L'], JO:['JOD','C/D/F/G/J'], KZ:['KZT','C/F'], LB:['LBP','C/D/G'], LT:['EUR','C/F'], LU:['EUR','C/F'], LV:['EUR','C/F'],
  LY:['LYD','C/D/F/L'], MA:['MAD','C/E'], MD:['MDL','C/F'], ME:['EUR','C/F'], MK:['MKD','C/F'], MT:['EUR','G'], NL:['EUR','C/F'], NO:['NOK','C/F'],
  OM:['OMR','C/G'], PL:['PLN','C/E'], PT:['EUR','C/F'], RO:['RON','C/F'], RS:['RSD','C/F'], RU:['RUB','C/F'], SA:['SAR','G'], SE:['SEK','C/F'],
  SI:['EUR','C/F'], SK:['EUR','C/E'], TN:['TND','C/E'], TR:['TRY','C/F'], UA:['UAH','C/F'], UZ:['UZS','C/F'], XK:['EUR','C/F']
};
let layOpen = {};   // which layover boxes are open, kept across re-renders
async function fxLoad(){
  const f = state.fx;
  if(f && Date.now() - f.at < 864e5) return f;
  if(navigator.onLine === false) return f || null;
  try{
    const r = await fetch('https://open.er-api.com/v6/latest/EUR', {cache:'no-store'}); const j = await r.json();
    if(j && j.result === 'success' && j.rates){
      const want = new Set(Object.values(CTRY).map(x => x[0])), rates = {};
      for(const c of want) if(j.rates[c]) rates[c] = j.rates[c];
      state.fx = { at: Date.now(), r: rates }; save();
    }
  }catch(e){}
  return state.fx || null;
}
function fxTxt(cur){
  if(cur === 'EUR') return '';
  const f = state.fx, v = f && f.r && f.r[cur];
  if(!v) return t('lay_fxOff');
  const nf = new Intl.NumberFormat(LOC, {maximumSignificantDigits: v >= 100 ? 5 : 3});
  return t('lay_fx', {v: nf.format(v), c: cur});
}
function fxFill(){ fxLoad().then(() => document.querySelectorAll('[data-fx]').forEach(el => { el.textContent = fxTxt(el.dataset.fx); })).catch(() => {}); }
function layBody(st){
  const a = AP[st], c = a && CTRY[a.cc], base = state.settings.base || 'PMI', now = Date.now();
  const rows = [];
  if(a && a.tz){
    const dh = tzDiffH(base, st, now), dtxt = dh ? t('lay_diff', {h: (dh > 0 ? '+' : '−') + String(Math.abs(dh)).replace('.', ','), b: base}) : t('lay_same', {b: base});
    rows.push(`<div>🕐 <b>${localHM(now, st)}</b> ${t('lay_time')} · ${dtxt}</div>`);
  }
  if(c){
    rows.push(`<div>💶 ${t('lay_cur')}: <b>${c[0]}</b>${c[0] !== 'EUR' ? ` · <span data-fx="${c[0]}">${fxTxt(c[0])}</span>` : ''}</div>`);
    rows.push(`<div>🔌 ${t('lay_plug', {p: c[1], v: 230})}</div>`);
  }
  const note = (state.notes || {})[st] || '';
  return `${rows.length ? `<div class="lay-g">${rows.join('')}</div>` : ''}
    <label class="lay-n"><span class="note">📝 ${t('lay_notes')}</span><textarea data-note="${esc(st)}" rows="3" placeholder="${esc(t('lay_ph'))}">${esc(note)}</textarea></label>`;
}
function layHtml(st, extra){
  const a = AP[st], city = a ? a.city : st;
  return `<details class="td-lay" data-lay="${esc(st)}"${layOpen[st] ? ' open' : ''}><summary>🧳 ${t('lay_title', {c: esc(city) + ' (' + st + ')'})}${extra ? ` <span class="note">${extra}</span>` : ''}${(state.notes||{})[st] ? ' 📝' : ''}</summary>${layBody(st)}</details>`;
}
let noteTimer = null;
document.addEventListener('input', e => {
  const st = e.target.dataset && e.target.dataset.note; if(!st) return;
  state.notes = state.notes || {}; const v = e.target.value;
  if(v.trim()) state.notes[st] = v; else if(!state.layExtra || !state.layExtra.includes(st)) delete state.notes[st]; else state.notes[st] = '';
  clearTimeout(noteTimer); noteTimer = setTimeout(save, 400);
});
document.addEventListener('toggle', e => { const st = e.target.dataset && e.target.dataset.lay; if(st) layOpen[st] = e.target.open; if(st && e.target.open) fxFill(); }, true);

function renderLay(msg){
  const base = state.settings.base || 'PMI', nights = {}, visits = {};
  for(const k of Object.keys(state.months)){
    let c; try{ c = PR.compute(state.months[k], state.settings, state.extras); }catch(e){ continue; }
    for(const d of c.days){
      if(d.hotel && d.hotel !== base) nights[d.hotel] = (nights[d.hotel] || 0) + 1;
      for(const l of d.legs) if(l.arr !== base) visits[l.arr] = (visits[l.arr] || 0) + 1;
    }
  }
  const extra = state.layExtra || [];
  const all = [...new Set([...Object.keys(nights), ...extra, ...Object.keys(state.notes || {})])];
  all.sort((a, b) => (nights[b] || 0) - (nights[a] || 0) || (visits[b] || 0) - (visits[a] || 0) || a.localeCompare(b));
  pnl(hdr('lay', t('lay_intro')) + `<div class="row" style="align-items:flex-end;gap:8px">
      <label class="note" style="display:grid;gap:4px">${t('lay_add')}<input type="text" id="lay-in" maxlength="3" autocapitalize="characters" placeholder="RAK" style="width:90px;text-transform:uppercase"></label>
      <button class="btn ghost" type="button" id="lay-go">＋</button></div>${msg || ''}
    ${all.length ? `<div class="laylist">${all.map(st => layHtml(st, nights[st] ? t('lay_n', {n: nights[st]}) : '')).join('')}</div>` : `<p class="msg">${t('lay_none')}</p>`}`);
  fxFill();
}
document.addEventListener('click', e => {
  if(e.target.id !== 'lay-go') return;
  const st = String(($('lay-in') || {}).value || '').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(st) || !AP[st]){ renderLay(`<p class="msg err">${t('lay_bad')}</p>`); return; }
  state.layExtra = [...new Set([...(state.layExtra || []), st])]; layOpen[st] = true; save(); renderLay();
});

// ---------- month so far ----------
function soFarHtml(c, ro){
  const tdy = todayISO(); if(key(ro) !== tdy.slice(0, 7)) return '';
  // the bar is the part of the month's work already done; the total is the month's variable pay,
  // which can include the minimum guarantees (hours, per diems) that no single day carries
  const a = c.days.filter(d => d.date <= tdy).reduce((s, d) => s + (d.total || 0), 0), all = c.days.reduce((s, d) => s + (d.total || 0), 0);
  if(!(all > 0)) return '';
  const guar = c.topUp > 0 || c.dietasPaid > c.dietas;
  return `<div class="sofar"><div class="sftrack"><div style="width:${Math.min(100, a / all * 100).toFixed(1)}%"></div></div><div class="note">${t('sofar', {a: eur.format(a), b: eur.format(c.variable)})}${guar ? ' ' + t('sofar_min') : ''}</div></div>`;
}

// ---------- swap with a colleague (a shared roster) ----------
// Their day goes into a copy of my roster. The shared roster has no FDP or duty-time values,
// so they are rebuilt: FDP = check-in to last on-block, duty = check-in to check-out.
let cmpCur = null;
function dayFromShared(orig, o){
  const d = Object.assign({}, orig, { events: [], hotel: (o && o.hotel) || null, crew: [], gcrew: [] });
  delete d.fdp; delete d.dt; delete d.dtLimit; delete d.bt; delete d.dp;
  const L = (o && o.legs || []).filter(l => l.dep && l.arr && l.t1 && l.t2);
  if(!L.length){
    if(o && o.label) d.events.push({ type:'code', code:o.label, label:o.label, st:o.startLoc || null, t1:o.ci || null, t2:o.co || null, arr:null });
    return d;
  }
  if(o.ci) d.events.push({ type:'ci', st:L[0].dep, t1:o.ci });
  for(const l of L) d.events.push({ type:l.type === 'dh' ? 'dh' : 'flt', flight:l.flight, dep:l.dep, arr:l.arr, t1:l.t1, t2:l.t2 });
  if(o.co) d.events.push({ type:'co', st:L[L.length-1].arr, t1:o.co });
  const m = x => +x.slice(0, 2) * 60 + +x.slice(2), span = (a, b) => { let v = m(b) - m(a); if(v < 0) v += 1440; return v / 60; };
  if(o.ci){ d.fdp = span(o.ci, L[L.length-1].t2); d.dt = o.co ? Math.max(d.fdp, span(o.ci, o.co)) : d.fdp + 0.5; }
  return d;
}
function runSwap(){
  const out = $('swp-out'); if(!out || !cmpCur) return;
  const dates = [...document.querySelectorAll('[data-swp]:checked')].map(x => x.dataset.swp);
  if(!dates.length){ out.innerHTML = `<p class="msg err">${t('swp_none')}</p>`; return; }
  const { ro, theirs } = cmpCur, s = state.settings;
  const ro2 = JSON.parse(JSON.stringify(ro)), ex2 = JSON.parse(JSON.stringify(state.extras || {}));
  for(const dt of dates){
    const i = ro2.days.findIndex(d => d.date === dt); if(i < 0) continue;
    ro2.days[i] = dayFromShared(ro2.days[i], theirs.find(x => x.date === dt));
    delete ex2[dt];
  }
  const a = PR.compute(ro, s, state.extras), b = PR.compute(ro2, s, ex2);
  const [ny, nmn] = nextYM(ro.year, ro.month), Na = slipFor(a, s, ny, nmn), Nb = slipFor(b, s, ny, nmn);
  const tier = x => x.T > b.rates.limits[1] ? 3 : x.T > b.rates.limits[0] ? 2 : 1, dn = Nb.net - Na.net;
  const sign = x => (x >= 0 ? '+' : '−') + eur.format(Math.abs(x));
  const dd = iso => new Date(iso + 'T12:00').toLocaleDateString(LOC, {weekday:'short', day:'numeric'});
  // always an estimate: say so before the numbers, and mark the numbers with ≈
  out.innerHTML = `<div class="msg est">⚠️ <b>${t('swp_estT')}</b> · ${t('swp_note')}</div><dl class="sumbox" style="margin-top:12px">
      <dt>${t('variableIn', {m: nm(ro.year, ro.month, {month:'long'})})}</dt><dd>${eur.format(a.variable)} → <b>≈ ${eur.format(b.variable)}</b></dd>
      <dt>${t('dutyTime', {h: fmtH(a.T)})} → ${fmtH(b.T)} h</dt><dd>${t('tierN', {n: tier(a)})} → ${t('tierN', {n: tier(b)})}</dd>
      <dt class="netrow">${t('sim_net', {m: nm(ny, nmn, {month:'long'})})}</dt><dd class="netrow ${dn < 0 ? 'neg' : 'pos'}">≈ ${sign(dn)}</dd></dl>
    <p class="note">${t('swp_days', {d: dates.map(dd).join(', ')})}</p>`;
}
document.addEventListener('click', e => { if(e.target.id === 'cmp-swp') runSwap(); });

// ---------- install as an app ----------
let instEvt = null;
const isStandalone = () => { try{ return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }catch(e){ return false; } };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function renderInstall(){
  const el = $('instRow'); if(!el) return;
  if(isStandalone() || (!instEvt && !isIOS())){ el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<b>📲 ${t('inst_t')}</b><p class="note" style="margin:6px 0">${t('inst_why')}</p>` +
    (instEvt ? `<button class="btn" id="inst-go" type="button">${t('inst_btn')}</button>` : `<p class="note" style="margin:0">${t('inst_ios')}</p>`);
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); instEvt = e; renderInstall(); });
addEventListener('appinstalled', () => { instEvt = null; renderInstall(); });
document.addEventListener('click', async e => {
  if(e.target.id !== 'inst-go' || !instEvt) return;
  try{ instEvt.prompt(); await instEvt.userChoice; }catch(err){}
  instEvt = null; renderInstall();
});

// ---------- settings to another phone by QR ----------
// Contract data, licences and layover notes travel inside the link, after the #, so they never reach
// a server. Rosters and payslips stay out: they are too big for a QR and have their own backup.
function cfgPayload(withNotes){
  const lic = (state.lic || []).filter(x => !x.del && x.exp).map(x => ({ key: x.key, name: x.name, exp: x.exp }));
  const p = { v: 1, at: todayISO(), s: state.settings, lic };
  if(withNotes && state.notes && Object.keys(state.notes).length) p.notes = state.notes;
  return p;
}
const cfgEncode = p => '1' + b64u(fflate.deflateSync(new TextEncoder().encode(JSON.stringify(p)), {level: 9}));
function cfgMake(){
  const out = $('cfg-out'); if(!out) return;
  let str = cfgEncode(cfgPayload(true)), trimmed = false;
  if(str.length > 2200 && state.notes){ str = cfgEncode(cfgPayload(false)); trimmed = true; }
  const url = SHARE_BASE + '#cfg=' + str;
  let qr = '';
  try{ const q = qrcode(0, 'L'); q.addData(url); q.make(); qr = q.createSvgTag({cellSize: 4, margin: 2, scalable: true}); }catch(err){ qr = ''; }
  out.innerHTML = `${qr ? `<div class="cfgqr">${qr}</div>` : ''}${trimmed ? `<p class="note">${t('cfg_trim')}</p>` : ''}
    <p class="note">${t('cfg_link')}</p><input type="text" id="cfg-url" readonly value="${esc(url)}">
    <div class="row" style="margin-top:8px"><button class="btn ghost" id="cfg-copy" type="button">${t('cfg_copy')}</button><span class="note" id="cfg-msg"></span></div>`;
}
let cfgPending = null;
function cfgOpen(str){
  try{
    if(str[0] !== '1') throw 0;
    const p = JSON.parse(new TextDecoder().decode(fflate.inflateSync(unb64u(str.slice(1)))));
    if(!p || p.v !== 1 || !p.s) throw 0;
    cfgPending = p;
    showMsg(`${t('cfg_ask', {d: esc(p.at || '')})}<div class="row" style="margin-top:8px"><button class="btn" id="cfg-ok" type="button">${t('cfg_ok')}</button><button class="btn ghost" id="cfg-no" type="button">${t('no')}</button></div>`);
  }catch(e){ showMsg(t('cfg_bad'), true); }
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
}
function cfgApply(){
  const p = cfgPending; if(!p) return; cfgPending = null;
  state.settings = Object.assign({}, state.settings, p.s);
  const L = state.lic = state.lic || [];
  for(const x of p.lic || []){
    const have = L.find(y => !y.del && (x.key ? y.key === x.key : y.name === x.name));
    if(have){ if(!have.exp || x.exp > have.exp) have.exp = x.exp; }
    else L.push({ key: x.key, name: x.name, exp: x.exp });
  }
  if(p.notes){ state.notes = state.notes || {}; for(const k in p.notes) if(!state.notes[k]) state.notes[k] = p.notes[k]; }
  save(); render(); showMsg(t('cfg_done'));
}
document.addEventListener('click', async e => {
  const id = e.target.id;
  if(id === 'cfg-make'){ cfgMake(); return; }
  if(id === 'cfg-copy'){ const i = $('cfg-url'); try{ await navigator.clipboard.writeText(i.value); $('cfg-msg').textContent = t('share_copied'); }catch(err){ i.focus(); i.select(); } return; }
  if(id === 'cfg-ok'){ cfgApply(); return; }
  if(id === 'cfg-no'){ cfgPending = null; $('importMsg').hidden = true; return; }
  const td = e.target.closest('[data-trkdel]');
  if(td){ delete (state.tracks || {})[td.dataset.trkdel]; save(); if(toolOpen === 'map' && !mm) renderMap(); return; }
});
