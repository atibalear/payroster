// ---- Payroster extras: pick-up, sleep time, weather, Face ID lock, FTL "from today", backup reminder ----

// transport before a duty («Pick Up» line, or TAXI/TAXI_LAT before a ground duty), in ms (UTC)
function pickupMs(date, events, startMs){
  const ev = (events||[]).find(e => e.type==='pickup' && e.t1) || (events||[]).find(e => e.type==='code' && /^TAXI/.test(e.code||'') && e.t1);
  if(!ev) return null;
  let pk = utcAt(date, ev.t1); if(pk > startMs) pk -= 864e5;
  return (pk >= startMs || startMs - pk > 4*36e5) ? null : pk;
}

// ---------- 1. sleep time ----------
const sleepCfg = () => ({ h: +state.settings.sleepH || 8, prep: state.settings.prepMin != null ? +state.settings.prepMin : 60 });
function sleepPlan(startMs, pk){
  const c = sleepCfg(), wake = (pk || startMs) - c.prep*60e3, bed = wake - c.h*36e5;
  return { wake, bed, h: c.h, prep: c.prep };
}
function sleepHtml(x, pk, now){
  const p = sleepPlan(x.start, pk);
  if(now > p.wake || p.bed - now > 20*36e5) return '';
  const st = x.st || state.settings.base || 'PMI', late = now > p.bed;
  return `<div class="note td-sleep${late ? ' late' : ''}">😴 ${t(late ? 'sl_late' : 'sl_line', {h: p.h, b: localHM(p.bed, st), w: localHM(p.wake, st), n: hhmm(Math.max(0, p.wake - now)/36e5)})}</div>`;
}

// ---------- 3. weather, sunrise / sunset, time difference ----------
const WX = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',56:'🌧️',57:'🌧️',61:'🌦️',63:'🌧️',65:'🌧️',66:'🌧️',67:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',85:'🌨️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️' };
const wxCache = {};
async function wxFetch(stations, date){
  const ok = stations.filter(s => AP[s]);
  if(!ok.length) return {};
  const d0 = new Date(date+'T12:00:00Z'); d0.setUTCDate(d0.getUTCDate()-1);
  const d1 = new Date(date+'T12:00:00Z'); d1.setUTCDate(d1.getUTCDate()+2);
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + ok.map(s => AP[s].lat.toFixed(3)).join(',') + '&longitude=' + ok.map(s => AP[s].lon.toFixed(3)).join(',') +
    '&hourly=temperature_2m,weather_code&daily=sunrise,sunset&timezone=GMT&timeformat=unixtime&start_date=' + d0.toISOString().slice(0,10) + '&end_date=' + d1.toISOString().slice(0,10);
  const ck = 'pr.wx.' + url;
  if(wxCache[url] && Date.now() - wxCache[url].at < 36e5) return wxCache[url].v;
  try{ const c = JSON.parse(sessionStorage.getItem(ck) || 'null'); if(c && Date.now() - c.at < 36e5){ wxCache[url] = c; return c.v; } }catch(e){}
  const r = await fetch(url); if(!r.ok) throw new Error('wx');
  let j = await r.json(); if(!Array.isArray(j)) j = [j];
  const v = {}; ok.forEach((s, i) => v[s] = j[i]);
  wxCache[url] = { at: Date.now(), v }; try{ sessionStorage.setItem(ck, JSON.stringify(wxCache[url])); }catch(e){}
  return v;
}
function wxAt(w, ms){
  if(!w || !w.hourly) return null;
  const T = w.hourly.time, s = ms/1000; let best = 0;
  for(let i = 0; i < T.length; i++) if(Math.abs(T[i] - s) < Math.abs(T[best] - s)) best = i;
  if(Math.abs(T[best] - s) > 3*3600) return null;
  return { temp: Math.round(w.hourly.temperature_2m[best]), ic: WX[w.hourly.weather_code[best]] || '🌡️' };
}
function tzDiffH(stA, stB, ms){
  const off = st => { const p = new Intl.DateTimeFormat('en-US', {timeZone: PR.tzOf(st), timeZoneName:'shortOffset'}).formatToParts(new Date(ms)).find(x => x.type==='timeZoneName'); const m = /GMT([+-]\d+)?(?::(\d+))?/.exec(p ? p.value : ''); return m && m[1] ? +m[1] + (m[2] ? Math.sign(+m[1]) * m[2]/60 : 0) : 0; };
  try{ return off(stB) - off(stA); }catch(e){ return 0; }
}
async function loadWx(x){
  const box = $('today'); if(!box) return;
  const slots = [...box.querySelectorAll('[data-wx]')], hotelEl = $('tdHotel'), hotel = x.hotel || x.d.hotel;
  if(!IS_PWA_BUILD || navigator.onLine === false || x.start - Date.now() > 14*864e5) return;
  const legs = (x.d.legs||[]).filter(l => l.dep && l.arr && l.t1);
  const depSt = legs.length ? legs[0].dep : x.st;
  const stations = [...new Set([depSt].concat(slots.map(s => s.dataset.wx.split('|')[0]), hotel ? [hotel] : []).filter(Boolean))];
  let v; try{ v = await wxFetch(stations, x.date); }catch(e){ return; }
  if(!document.body.contains(box)) return;
  for(const s of slots){ const [st, ms] = s.dataset.wx.split('|'); const w = wxAt(v[st], +ms); if(w) s.innerHTML = `${w.ic} ${w.temp}°`; }
  if(hotel && hotelEl && v[hotel] && v[hotel].daily){
    const D = v[hotel].daily, ref = (x.end || x.start) / 1000;
    let i = D.time.findIndex(tt => tt + 86400 > ref); if(i < 0) i = 0;
    const base = state.settings.base || 'PMI', dh = tzDiffH(base, hotel, x.start);
    const sr = D.sunrise[i] ? localHM(D.sunrise[i]*1000, hotel) : '', ss = D.sunset[i] ? localHM(D.sunset[i]*1000, hotel) : '';
    hotelEl.innerHTML = `<span>🏨 ${t('nightIn',{st:esc(hotel)})}</span><span class="sun">🌅 ${sr} · 🌇 ${ss}${dh ? ' · ' + t('wx_tz', {h: (dh > 0 ? '+' : '') + String(dh).replace('.', ',')}) : ''}</span>`;
  }
}

// ---------- 4. Face ID / passcode lock (installed app only) ----------
const LOCK_KEY = 'pr.lock';
const lkB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const lkUnB64 = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const lockId = () => { try{ return localStorage.getItem(LOCK_KEY); }catch(e){ return null; } };
const lkRnd = n => crypto.getRandomValues(new Uint8Array(n));
async function lockAvailable(){
  try{ return IS_PWA_BUILD && window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }catch(e){ return false; }
}
async function lockEnable(){
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: lkRnd(32), rp: { name: 'Payroster' },
    user: { id: lkRnd(16), name: 'payroster', displayName: 'Payroster' },
    pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
    authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required', residentKey:'discouraged' }, timeout: 60000 } });
  localStorage.setItem(LOCK_KEY, lkB64(cred.rawId));
}
async function lockVerify(){
  const id = lockId(); if(!id) return true;
  await navigator.credentials.get({ publicKey: { challenge: lkRnd(32), allowCredentials: [{ type:'public-key', id: lkUnB64(id) }], userVerification:'required', timeout: 60000 } });
  return true;
}
let lockBusy = false;
async function unlock(silent){
  if(lockBusy) return; lockBusy = true;
  const msg = $('lockMsg'); if(msg) msg.textContent = '';
  try{ await lockVerify(); document.documentElement.classList.remove('locked'); }
  catch(e){ if(msg && !silent) msg.textContent = t('lk_fail'); }
  lockBusy = false;
}
function showLock(){
  if(!lockId()) return;
  document.documentElement.classList.add('locked');
  let ov = $('lockScr');
  if(!ov){ ov = document.createElement('div'); ov.id = 'lockScr'; document.body.appendChild(ov); }
  ov.innerHTML = `<div class="lk-in"><div class="lk-logo">Pay<span>roster</span><sup>+</sup></div><div class="lk-ic">🔒</div>
    <button class="btn" id="lockGo" type="button">${t('lk_open')}</button><p class="note" id="lockMsg"></p></div>`;
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'hidden') hiddenAt = Date.now();
  else if(lockId() && hiddenAt && Date.now() - hiddenAt > 60e3){ showLock(); unlock(true); }
});
async function renderLockBox(){
  const el = $('lockBox'); if(!el) return;
  if(!(await lockAvailable())){ el.hidden = true; return; }
  el.hidden = false;
  const on = !!lockId();
  el.innerHTML = `<h2 style="margin:0 0 6px">${t('lk_title')}</h2>
    <label class="chk"><input type="checkbox" id="lockChk"${on ? ' checked' : ''}> ${t('lk_toggle')}</label>
    <p class="note">${t('lk_note')}</p><p class="note" id="lockOut"></p>`;
}

// ---------- 5. EASA limits from today (rolling windows) ----------
function ftlNow(){
  const map = ftlTimeline(), s = state.settings, today = todayISO();
  const sc = full => s.contract >= 100 ? full : Math.min(full, Math.round(full * s.contract/100 * 1.1));
  const add = (iso, n) => { const d = new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
  const win = (end, n, f) => { let sum = 0; for(let i = 0; i < n; i++){ const x = map[add(end,-i)]; if(x) sum += x[f]; } return sum; };
  const defs = [{ k:'ftl_d7', n:7, f:'duty', lim:60 }, { k:'ftl_d28', n:28, f:'duty', lim:sc(190) }, { k:'ftl_b28', n:28, f:'block', lim:sc(100) }];
  // worst point from today over the next 28 days of the planned roster
  return defs.map(d => { let worst = { sum: win(today, d.n, d.f), end: today };
    for(let i = 1; i <= 28; i++){ const e = add(today, i); if(!map[e]) break; const v = win(e, d.n, d.f); if(v > worst.sum) worst = { sum: v, end: e }; }
    return { ...d, now: win(today, d.n, d.f), worst }; });
}
// one meter tile row: title, value on the right, a bar, a plain line under it
function meterRow(o){
  const p = Math.max(0, Math.min(100, o.p||0));
  return `<div class="mr ${o.tone||''}"><div class="mh"><span class="mt">${o.t}</span><span class="mv">${o.v}</span></div>
    ${o.p != null ? `<div class="mbar"><i style="width:${Math.max(p, p ? 2 : 0)}%"></i></div>` : ''}${o.s ? `<div class="ms">${o.s}</div>` : ''}</div>`;
}
const meterTone = p => p >= 100 ? 'over' : p >= 90 ? 'warn' : '';
function ftlNowHtml(){
  let L; try{ L = ftlNow(); }catch(e){ return ''; }
  const dd = iso => new Date(iso+'T12:00').toLocaleDateString(LOC, {day:'numeric', month:'short'});
  return `<div class="mgT">${t('ftl_nowT')}</div><div class="mg">${L.map(i => { const p = i.now/i.lim*100;
    return meterRow({t:t(i.k), v:t('mt_used', {p:Math.round(p)}), p, tone:meterTone(p),
      s:`${fmtH(i.now)} / ${i.lim} h · ${t('ftl_left', {h: fmtH(Math.max(0, i.lim - i.now))})}${i.worst.end !== todayISO() && i.worst.sum > i.now ? ' · ' + t('ftl_peak', {h: fmtH(i.worst.sum), d: dd(i.worst.end)}) : ''}`}); }).join('')}</div>`;
}
function ftlAlertHtml(){
  let L; try{ L = ftlNow(); }catch(e){ return ''; }
  const bad = L.filter(i => i.worst.sum >= i.lim * 0.9);
  return bad.map(i => `<span class="chip c-bez">⚠ ${t(i.k)}: ${fmtH(i.worst.sum)} / ${i.lim} h</span>`).join('');
}

// ---------- 7. backup reminder ----------
function renderBkRemind(){
  const el = $('bkRemind'); if(!el) return;
  const n = Object.keys(state.months).length, today = todayISO();
  const last = state.lastBackup, days = last ? Math.round((Date.parse(today) - Date.parse(last)) / 864e5) : null;
  const show = n > 0 && (days == null || days >= 30) && !(state.bkSnooze && state.bkSnooze > today);
  el.hidden = !show; if(!show){ el.innerHTML = ''; return; }
  el.innerHTML = `<div class="eyebrow">${t('bkr_title')}</div><p style="margin:6px 0 10px">${days == null ? t('bkr_never') : t('bkr_days', {n: days})}</p>
    <div class="row"><button class="btn" type="button" data-tool="backup">${t('bk_export')}</button><button class="btn ghost" type="button" id="bkLater">${t('bkr_later')}</button></div>`;
}

document.addEventListener('click', async e => {
  const id = e.target.id;
  if(id === 'lockGo'){ unlock(); return; }
  if(id === 'bkLater'){ const d = new Date(); d.setDate(d.getDate() + 7); state.bkSnooze = d.toISOString().slice(0,10); save(); renderBkRemind(); return; }
});
document.addEventListener('change', async e => {
  if(e.target.id === 'lockChk'){
    const out = $('lockOut');
    try{
      if(e.target.checked){ await lockEnable(); if(out) out.textContent = t('lk_on'); }
      else { await lockVerify(); localStorage.removeItem(LOCK_KEY); if(out) out.textContent = t('lk_off'); }
    }catch(err){ e.target.checked = !!lockId(); if(out) out.textContent = t('lk_fail'); }
    return;
  }
  if(e.target.id === 'sl-h' || e.target.id === 'sl-p'){
    state.settings[e.target.id === 'sl-h' ? 'sleepH' : 'prepMin'] = +e.target.value; save(); renderToday(); return;
  }
});
// on start: lock screen first
if(lockId()) setTimeout(() => { showLock(); setTimeout(() => unlock(true), 300); }, 0);

// ---------- base check: the roster's home base vs. the base in My details ----------
function rosterBase(ro){
  const n = {};
  for(const d of (ro && ro.days) || []){ const ci = (d.events||[]).find(e => (e.type==='ci' || e.type==='su') && e.st); if(ci) n[ci.st] = (n[ci.st]||0) + 1;
    const co = [...(d.events||[])].reverse().find(e => e.type==='co' && e.st); if(co && !d.hotel) n[co.st] = (n[co.st]||0) + 2; }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 4 ? top[0] : null;
}
function renderBaseWarn(ro){
  const el = $('baseWarn'); if(!el) return;
  const rb = rosterBase(ro), b = state.settings.base || 'PMI';
  if(ro && ro.to){
    const dl = new Date(Date.UTC(ro.year, ro.month-1, ro.to)).toLocaleDateString(LOC, {day:'numeric', month:'long', timeZone:'UTC'});
    el.hidden = false;
    el.innerHTML = `<div class="eyebrow">${t('pt_title')}</div><p style="margin:6px 0 10px">${t('pt_text', {d: dl, m: monthName(ro.year, ro.month, {month:'long'})})}</p>
      <button class="btn" type="button" data-pdf-pick="1">＋ PDF</button>`;
    return;
  }
  if(!rb || rb === b){ el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div class="eyebrow">⚠ ${t('bw_title')}</div><p style="margin:6px 0 10px">${t('bw_text', {r: rb, b})}</p>
    <button class="btn" type="button" id="bwFix" data-b="${rb}">${t('bw_fix', {r: rb})}</button>`;
}
document.addEventListener('click', e => { if(e.target.dataset && e.target.dataset.pdfPick){ const i = document.getElementById('pdfIn'); if(i) i.click(); return; } if(e.target.id === 'bwFix'){ state.settings.base = e.target.dataset.b; save(); render(); } });

// ---------- IRPF: will this year's withholding be enough? (Illes Balears scale) ----------
const IRPF_STATE = [[12450,9.5],[20200,12],[35200,15],[60000,18.5],[300000,22.5],[Infinity,24.5]];
const IRPF_BAL = [[10000,9],[18000,11.25],[30000,14.25],[48000,17.5],[70000,19],[90000,21.75],[120000,22.75],[175000,23.75],[Infinity,24.75]];
function irpfScale(sc, b){ let tax = 0, lo = 0; for(const [hi, r] of sc){ if(b <= lo) break; tax += (Math.min(b, hi) - lo) * r / 100; lo = hi; } return tax; }
function irpfYear(year, rows, kids, under3){
  const full = rows.filter(r => !r.partial && r.gross != null);
  const avg = f => full.length ? full.reduce((a, r) => a + (+r[f]||0), 0) / full.length : 0;
  const have = new Set(full.map(r => r.m)), miss = 12 - have.size;
  let G = 0, SS = 0, Rreal = 0, Gfut = 0, Rfut = 0;
  for(const r of full){ const g = r.gross - (r.dietas||0); G += g; SS += r.ss||0; if(r.real){ Rreal += r.irpf||0; } else { Gfut += g; Rfut += r.irpf||0; } }
  const gAvg = avg('gross') - avg('dietas');
  G += gAvg * miss; SS += avg('ss') * miss; Gfut += gAvg * miss; Rfut += avg('irpf') * miss;
  let net = Math.max(0, G - SS - 2000);
  // reducción por obtención de rendimientos del trabajo (art. 20 LIRPF), only for low incomes
  const red = net <= 14852 ? 7302 : net <= 17673.52 ? 7302 - 1.75*(net-14852) : net <= 19747.5 ? 2364.34 - 1.14*(net-17673.52) : 0;
  const base = Math.max(0, net - red);
  const dState = [2400, 2700, 4000, 4500], dBal = [2400, 2970, 4400, 4950];
  let minS = 5550, minB = 5550;
  for(let i = 0; i < kids; i++){ minS += dState[Math.min(i, 3)]; minB += dBal[Math.min(i, 3)]; }
  minS += 2800 * under3; minB += 2800 * under3;
  const cuota = Math.max(0, irpfScale(IRPF_STATE, base) - irpfScale(IRPF_STATE, Math.min(base, minS))) + Math.max(0, irpfScale(IRPF_BAL, base) - irpfScale(IRPF_BAL, Math.min(base, minB)));
  const R = Rreal + Rfut, need = Gfut > 0 ? (cuota - Rreal) / Gfut * 100 : null;
  return { G, SS, base, cuota, Rreal, Rfut, R, diff: cuota - R, need, miss, months: have.size, Gfut };
}
function irpfHtml(year, rows){
  const s = state.settings, f = state.fam || {};
  const bornBy = f.birth && f.birth <= year + '-12-31';
  const kids = s.kids != null ? +s.kids : (bornBy ? 1 : 0);
  const under3 = Math.min(kids, s.kids3 != null ? +s.kids3 : (bornBy ? 1 : 0));
  const x = irpfYear(year, rows, kids, under3);
  if(!x.G) return '';
  const pay = x.diff > 150, back = x.diff < -150;
  return `<h3 class="wh">${t('irpf_T', {y: year})}</h3>
    <div class="form" style="margin-top:0"><label>${t('irpf_kids')}<select id="irpf-kids">${[0,1,2,3,4].map(n => `<option${n===kids?' selected':''}>${n}</option>`).join('')}</select></label>
      <label>${t('irpf_kids3')}<select id="irpf-kids3">${[0,1,2,3,4].filter(n => n <= kids).map(n => `<option${n===under3?' selected':''}>${n}</option>`).join('')}</select></label></div>
    <div class="mlist">
      <div class="mrow"><div class="mh"><span>${t('irpf_owed')}</span><b class="num">${eur.format(x.cuota)}</b></div><div class="note num">${t('irpf_rate', {p: (x.cuota / x.G * 100).toFixed(1).replace('.', ',')})} · ${t('irpf_base', {b: eur0.format(x.base)})}</div></div>
      <div class="mrow"><div class="mh"><span>${t('irpf_ret')}</span><b class="num">${eur.format(x.R)}</b></div><div class="note num">${t('irpf_retSplit', {a: eur.format(x.Rreal), b: eur.format(x.Rfut), p: String(s.irpf).replace('.', ',')})}</div></div>
      <div class="mrow tot"><div class="mh"><span>${pay ? t('irpf_pay') : back ? t('irpf_back') : t('irpf_ok')}</span><b class="num" style="color:var(${pay ? '--warn' : '--pay'})">${pay || back ? eur.format(Math.abs(x.diff)) : '✓'}</b></div></div>
    </div>
    ${pay && x.need != null && x.Gfut > 500 ? `<p class="msg err">${t('irpf_raise', {p: Math.min(47, Math.ceil(x.need * 10) / 10).toFixed(1).replace('.', ',')})}</p>` : ''}
    <p class="note">${t('irpf_note', {n: x.months})}</p>`;
}
document.addEventListener('change', e => {
  if(e.target.id === 'irpf-kids' || e.target.id === 'irpf-kids3'){
    state.settings[e.target.id === 'irpf-kids' ? 'kids' : 'kids3'] = +e.target.value;
    if(state.settings.kids3 > state.settings.kids) state.settings.kids3 = state.settings.kids;
    save(); renderYear(); return;
  }
  if(e.target.id === 'ui-theme' || e.target.id === 'ui-zoom' || e.target.id === 'ui-style'){
    const u = uiPrefs(); u[e.target.id.slice(3)] = e.target.id === 'ui-zoom' ? +e.target.value : e.target.value;
    try{ localStorage.setItem('pr.ui', JSON.stringify(u)); }catch(err){}
    applyUi(); return;
  }
});

// ---------- display: theme and text size (kept per device) ----------
function uiPrefs(){ try{ return JSON.parse(localStorage.getItem('pr.ui') || '{}') || {}; }catch(e){ return {}; } }
function applyUi(){
  const u = uiPrefs(), r = document.documentElement;
  if(u.theme === 'light' || u.theme === 'dark') r.dataset.theme = u.theme; else delete r.dataset.theme;
  r.classList.toggle('glass', u.style !== 'classic');
  if(u.zoom && u.zoom !== 100) r.style.setProperty('--uiz', u.zoom / 100); else r.style.removeProperty('--uiz');
  const m = document.querySelector('meta[name=theme-color]');
  if(m){ const dark = u.theme === 'dark' || (u.theme !== 'light' && !!window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); m.content = dark ? '#161a2c' : '#f3f4f8'; }
}
function renderUiBox(){
  const el = $('uiBox'); if(!el) return;
  const u = uiPrefs(), th = u.theme || 'auto', z = u.zoom || 100;
  el.innerHTML = `<h2 style="margin:0 0 6px">${t('ui_T')}</h2><div class="form" style="margin-top:4px">
    <label>${t('ui_nick')}<input type="text" id="ui-nick" value="${esc(state.settings.nick || '')}" placeholder="${esc(myFirstName() || '')}" autocomplete="given-name"></label>
    <label>${t('ui_style')}<select id="ui-style">${[['glass','ui_st_glass'],['classic','ui_st_classic']].map(([v,k]) => `<option value="${v}"${v===(u.style||'glass')?' selected':''}>${t(k)}</option>`).join('')}</select></label>
    <label>${t('ui_theme')}<select id="ui-theme">${['auto','light','dark'].map(v => `<option value="${v}"${v===th?' selected':''}>${t('ui_th_'+v)}</option>`).join('')}</select></label>
    <label>${t('ui_zoom')}<select id="ui-zoom">${[[90,'ui_z_s'],[100,'ui_z_n'],[115,'ui_z_l'],[130,'ui_z_xl']].map(([v,k]) => `<option value="${v}"${v===z?' selected':''}>${t(k)}</option>`).join('')}</select></label></div>`;
}
applyUi();

// ---------- home-screen shortcuts (Android): ?go=next | pdf | mm ----------
setTimeout(() => {
  let go = null; try{ go = new URLSearchParams(location.search).get('go'); }catch(e){}
  if(!go) return;
  try{ history.replaceState(history.state, '', location.pathname); }catch(e){}
  if(go === 'next'){ setTab('roster'); const el = $('today'); if(el && !el.hidden) el.scrollIntoView({block:'start'}); }
  else if(go === 'pdf'){ setTab('roster'); const i = $('pdfIn'); if(i) try{ i.click(); }catch(e){} }
  else if(go === 'mm'){ if(typeof openTool === 'function'){ toolOpen = null; openTool('map'); if(typeof startMoving === 'function' && !mm) startMoving(); } }
}, 400);

// ---------- the agreement's amounts are for 2026 ----------
const CLA_YEAR = 2026;
function renderYearWarn(){
  const el = $('yearWarn'); if(!el) return;
  const y = new Date().getFullYear(), ro = state.months[state.current], ry = ro ? ro.year : y;
  const show = Math.max(y, ry) > CLA_YEAR && state.yearAck !== Math.max(y, ry);
  el.hidden = !show; if(!show){ el.innerHTML = ''; return; }
  el.innerHTML = `<div class="eyebrow">⚠ ${t('yw_title', {y: CLA_YEAR})}</div><p style="margin:6px 0 10px">${t('yw_text', {y: CLA_YEAR, n: Math.max(y, ry)})}</p>
    <button class="btn ghost" type="button" id="ywOk" data-y="${Math.max(y, ry)}">${t('yw_ok')}</button>`;
}
// ---------- report a problem (no personal data) ----------
function reportText(){
  const s = state.settings, ms = Object.keys(state.months).sort();
  const lines = [
    'Payroster ' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''), 'Parser v' + PR.PARSER_V,
    'Lang: ' + lang + ' · ' + navigator.userAgent.replace(/\(([^)]*)\)/, m => m.length > 60 ? m.slice(0, 60) + '…)' : m),
    'Rank: ' + s.rank + ' · contract ' + s.contract + ' % · base ' + s.base + ' · trainer ' + (s.isTrainer ? 'y' : 'n') + ' · CT ' + (s.isCT ? 'y' : 'n'),
    'Months: ' + ms.length + ' (' + (ms[0] || '-') + ' … ' + (ms[ms.length-1] || '-') + ') · payslips ' + Object.keys(state.slips||{}).length,
    'Stale: ' + ((state.stale||[]).join(', ') || '-'),
  ];
  const ro = state.months[state.current];
  if(ro){
    const c = PR.compute(ro, s, state.extras), kinds = {};
    c.days.forEach(d => kinds[d.kind] = (kinds[d.kind]||0) + 1);
    const codes = new Set(); ro.days.forEach(d => (d.events||[]).forEach(e => { if(e.type === 'code') codes.add(e.code); }));
    lines.push('Month ' + state.current + ': ' + Object.entries(kinds).map(([k, n]) => k + ' ' + n).join(', '));
    lines.push('Hours: FDP ' + hhmm(c.TF) + ' · add ' + hhmm(c.TA) + ' · block ' + hhmm(c.blockHours) + ' · per diems ' + JSON.stringify(c.dietaCounts));
    lines.push('Codes: ' + [...codes].sort().join(' '));
  }
  return lines.join('\n');
}
function renderReportBox(){
  const el = $('reportBox'); if(!el) return;
  el.innerHTML = `<h2 style="margin:0 0 6px">${t('rp_T')}</h2><p class="note" style="margin:0 0 8px">${t('rp_intro')}</p>
    <textarea id="rp-what" rows="3" placeholder="${t('rp_ph')}" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink)"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn" type="button" id="rp-go">${t('rp_go')}</button></div><p class="note" id="rp-out"></p>
    <p class="note">${t('unofficial')}</p>`;
}
document.addEventListener('click', async e => {
  if(e.target.id === 'ywOk'){ state.yearAck = +e.target.dataset.y; save(); renderYearWarn(); return; }
  if(e.target.id === 'rp-go'){
    const txt = ($('rp-what').value.trim() ? t('rp_what') + ': ' + $('rp-what').value.trim() + '\n\n' : '') + reportText(), out = $('rp-out');
    try{ if(navigator.share){ await navigator.share({ title: 'Payroster – ' + t('rp_T'), text: txt }); out.textContent = ''; return; } }catch(err){ if(err && err.name === 'AbortError') return; }
    try{ await navigator.clipboard.writeText(txt); out.textContent = t('rp_copied'); }
    catch(err){ out.innerHTML = `<textarea readonly rows="8" style="width:100%;font:12px var(--f-mono)">${esc(txt)}</textarea>`; }
    return;
  }
});

// ---------- sky header for the next-duty card: the sky follows the real sun at your airport ----------
function sunAlt(lat, lon, ms){
  const r = Math.PI/180, day = ms/864e5 + 2440587.5 - 2451545;
  const g = (357.529 + 0.98560028*day) * r, q = 280.459 + 0.98564736*day;
  const L = (q + 1.915*Math.sin(g) + 0.020*Math.sin(2*g)) * r, e = (23.439 - 0.00000036*day) * r;
  const ra = Math.atan2(Math.cos(e)*Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e)*Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908*day) % 24 + 24) % 24;
  const ha = (gmst*15 + lon)*r - ra, la = lat*r;
  return Math.asin(Math.sin(la)*Math.sin(dec) + Math.cos(la)*Math.cos(dec)*Math.cos(ha)) / r;
}
function skyPhase(st, ms){
  const a = AP[st]; if(!a) { const h = new Date(ms).getHours(); return h < 6 || h >= 21 ? 'night' : h < 9 ? 'dawn' : h < 18 ? 'day' : 'dusk'; }
  const alt = sunAlt(a.lat, a.lon, ms);
  if(alt > 8) return 'day';
  if(alt > -7){ const h = +localHM(ms, st).slice(0,2); return h < 13 ? 'dawn' : 'dusk'; }
  return 'night';
}
function skyHtml(x, cur, pk, now, legs, st){
  // what matters right now
  let lbl, target = null, big = '', from = null, to = null, frac = 0, flying = false;
  if(cur){
    const fl = legs.find(l => legStart(x.date, l) <= now && legEnd(x.date, l) > now);
    const nx = legs.find(l => legStart(x.date, l) > now);
    if(fl){ flying = true; from = fl.dep; to = fl.arr; const a = legStart(x.date, fl), b = legEnd(x.date, fl); frac = (now - a) / (b - a); target = b; lbl = t('sky_arr', {st: (AP[fl.arr] && AP[fl.arr].city) || fl.arr}); }
    else if(nx){ from = nx.dep; to = nx.arr; target = legStart(x.date, nx); lbl = t('sky_dep', {f: (nx.type==='dh' ? 'DH ' : '') + nx.flight}); }
    else { target = x.end; lbl = t('sky_end'); const lst = legs[legs.length-1]; if(lst){ from = lst.dep; to = lst.arr; frac = 1; } }
  } else {
    target = pk && pk > now ? pk : x.start; lbl = pk && pk > now ? t('td_pkin') : t('td_cin');
    const f = legs[0]; if(f){ from = f.dep; to = f.arr; }
  }
  big = target ? durTxt(Math.max(0, target - now)).replace(/ 0 min$/, '') : '';
  const here = flying ? from : (cur ? (legs.find(l => legStart(x.date, l) > now) || {}).dep || x.endSt || st : st);
  const ph = skyPhase(here || st, now);
  const sun = ph === 'night' ? `<circle cx="300" cy="34" r="13" fill="#f4f1e0" opacity=".92"/><circle cx="306" cy="30" r="12" fill="var(--sky-moon-cut)"/>`
    : ph === 'day' ? `<circle cx="300" cy="34" r="17" fill="#fff6c9"/>` : `<circle cx="${ph === 'dawn' ? 64 : 296}" cy="118" r="20" fill="#ffe2a8" opacity=".9"/>`;
  const px = 40 + 280 * Math.max(0, Math.min(1, frac)), py = (u => { const t2 = u; return (1-t2)*(1-t2)*112 + 2*(1-t2)*t2*(-6) + t2*t2*112; })(Math.max(0, Math.min(1, frac)));
  const arc = from && to ? `<svg class="sky-arc" viewBox="0 0 360 132" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${sun}
      <path d="M40 112 Q180 -6 320 112" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-dasharray="5 7" fill="none"/>
      ${frac > 0 ? `<path d="M40 112 Q180 -6 320 112" stroke="#ffd23f" stroke-width="3.5" fill="none" stroke-linecap="round" pathLength="100" stroke-dasharray="${(frac*100).toFixed(1)} 100"/>` : ''}
      <circle cx="40" cy="112" r="5" fill="#fff"/><circle cx="320" cy="112" r="5" fill="#fff"/>
      <text x="40" y="134" text-anchor="middle" fill="#fff" font-size="22" font-weight="700">${from}</text><text x="320" y="134" text-anchor="middle" fill="#fff" font-size="22" font-weight="700">${to}</text>
      ${flying || frac > 0 && frac < 1 ? `<text x="${px.toFixed(0)}" y="${(py+8).toFixed(0)}" text-anchor="middle" font-size="22" fill="#fff">✈︎</text>` : ''}</svg>` : `<svg class="sky-arc" viewBox="0 0 360 60" aria-hidden="true">${sun}</svg>`;
  const eb = (cur ? t('td_curT') : t('td_nextT')) + ' · ' + localDay(x.start, st);
  return `<div class="td-sky sky-${ph}">${ph === 'night' ? '<div class="stars"></div>' : ''}
    <div class="sky-top"><div class="eyebrow">${eb}</div>${x.st ? `<span class="td-base">📍 ${esc(x.st)}</span>` : ''}</div>
    <div class="sky-lbl">${lbl}</div><div class="sky-big"${target && target > now ? ` data-at="${target}"` : ''}>${big}</div>
    ${arc}</div>`;
}
// tomorrow + the next few duties, one line each (tap opens the day)
// the next few duties as little boarding-pass stubs you can swipe through
function upcomingHtml(x, duties){
  const i = duties.indexOf(x), nx = duties.slice(i + 1, i + 5);
  if(!nx.length) return '';
  const tmw = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })();
  return `<div class="td-next"><div class="eyebrow">${t('sky_later')}</div><div class="stubs">${nx.map(d => {
    const dt = new Date(d.date + 'T12:00'), wd = d.date === tmw ? t('sky_tmw') : dt.toLocaleDateString(LOC, {weekday:'short'});
    const r = (d.route || kind(d.kind).n), st = d.st || state.settings.base;
    return `<button type="button" class="stub" data-wk="${d.date}" style="--k:var(${kind(d.kind).c})">
      <span class="sbd"><b>${dt.getDate()}</b><small>${wd}</small></span>
      <span class="sbr"><b>${esc(r)}</b><small>${t('td_ci')} ${localHM(d.start, st)}</small></span></button>`; }).join('')}</div></div>`;
}
// the week as a route: one stop per day on a line, gold where you work, today ringed
const WK_SHORT = { deadhead:'DH', standby:'SBY', reserve:'RES', training:'TRN', ground:'GND', sick:'KCC' };
function renderWeek(){
  const el = $('weekStrip'); if(!el) return;
  const kinds = {};
  const today = todayISO(), days = [...Array(7)].map((_, i) => { const d = new Date(today + 'T12:00'); d.setDate(d.getDate() + i); return d.toISOString().slice(0,10); });
  for(const k of new Set(days.map(d => d.slice(0,7)))){
    const ro = state.months[k]; if(!ro) continue;
    try{ PR.compute(ro, state.settings, state.extras).days.forEach(d => kinds[d.date] = d); }catch(e){}
  }
  if(!days.some(d => kinds[d])){ el.hidden = true; return; }
  el.hidden = false;
  const work = k => k && !['off','empty'].includes(k.kind);
  el.innerHTML = `<div class="wr-line">${days.slice(0, 6).map((d, i) => `<i class="${work(kinds[d]) && work(kinds[days[i+1]]) ? 'on' : ''}"></i>`).join('')}</div>` +
    days.map((d, i) => { const k = kinds[d], dt = new Date(d + 'T12:00');
      const lab = !k ? '' : k.kind === 'flight' && k.route ? (k.route.split(/[–-]/)[1] || '') : (WK_SHORT[k.kind] || '');
      const cls = !k ? 'none' : k.kind === 'flight' ? 'fly' : ['off','empty'].includes(k.kind) ? 'off' : k.kind === 'sick' ? 'sick' : 'duty';
      return `<button type="button" class="wr${i === 0 ? ' now' : ''}" data-wk="${d}" style="--k:var(${k ? kind(k.kind).c : '--k-off'})">
        <span class="wl">${esc(lab)}</span><span class="wn ${cls}">${cls === 'fly' ? '✈︎' : ''}</span>
        <span class="wd">${dt.toLocaleDateString(LOC, {weekday:'narrow'})}<b>${dt.getDate()}</b></span></button>`; }).join('');
}
document.addEventListener('click', e => {
  const w = e.target.closest('[data-wk]'); if(!w) return;
  const d = w.dataset.wk, k = d.slice(0,7);
  if(typeof setTab === 'function') setTab('roster');
  if(state.current !== k && state.months[k]){ state.current = k; save(); render(); }
  setTimeout(() => { const r = $('d-' + d); if(r){ r.open = true; r.scrollIntoView({behavior:'smooth', block:'center'}); } }, 60);
});

// ---------- greeting in the header: good morning / afternoon / evening + your first name ----------
function myFirstName(){
  if(state.settings.nick) return state.settings.nick;
  const ks = Object.keys(state.months).sort().reverse();
  for(const k of ks){ const n = state.months[k] && state.months[k].crew; if(n){ const f = (n.split(',')[1] || n).trim().split(/\s+/)[0]; if(f) return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase(); } }
  return '';
}
function renderGreeting(){
  const g = $('hGreet'), d = $('hDate'); if(!g) return;
  const h = new Date().getHours(), key = h >= 5 && h < 12 ? 'hi_m' : h >= 12 && h < 20 ? 'hi_a' : 'hi_e', n = myFirstName();
  g.textContent = n ? t(key) + ', ' + n : t(key);
  if(d) d.textContent = '· ' + new Date().toLocaleDateString(LOC, {weekday:'long', day:'numeric', month:'short'});
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') try{ renderGreeting(); }catch(e){} });

document.addEventListener('change', e => { if(e.target.id === 'ui-nick'){ state.settings.nick = e.target.value.trim(); save(); renderGreeting(); } });

// ---------- month picker: tap (or long-press) the month in the bottom bar ----------
function openMonthPicker(){
  let pk = $('mPick');
  if(pk && !pk.hidden){ pk.hidden = true; return; }
  if(!pk){ pk = document.createElement('div'); pk.id = 'mPick'; pk.className = 'mpick'; document.body.appendChild(pk); }
  const have = new Set(Object.keys(state.months)), ys = [...new Set([...have].map(k => +k.slice(0,4)))].sort();
  if(!ys.length){ return; }
  const cur = state.current, nowK = todayISO().slice(0,7);
  pk.innerHTML = ys.reverse().map(y => `<div class="mp-y">${y}</div><div class="mp-g">${[...Array(12)].map((_, i) => {
      const k = y + '-' + String(i+1).padStart(2,'0'), on = have.has(k);
      return `<button type="button" class="mp-m${k === cur ? ' sel' : ''}${k === nowK ? ' now' : ''}"${on ? ` data-mpick="${k}"` : ' disabled'}>${new Date(y, i, 1).toLocaleDateString(LOC, {month:'short'}).replace('.', '')}</button>`; }).join('')}</div>`).join('');
  pk.hidden = false;
}
setTimeout(function(){
  const lab = document.getElementById('mLabel'); if(!lab) return;
  lab.setAttribute('role', 'button'); lab.tabIndex = 0;
  lab.addEventListener('click', openMonthPicker);
  let tm = null;
  lab.addEventListener('touchstart', () => { tm = setTimeout(() => { tm = null; openMonthPicker(); }, 450); }, {passive: true});
  ['touchend','touchmove','touchcancel'].forEach(ev => lab.addEventListener(ev, () => { if(tm){ clearTimeout(tm); tm = null; } }, {passive: true}));
  lab.addEventListener('contextmenu', e => e.preventDefault());
}, 0);
document.addEventListener('click', e => {
  const m = e.target.closest('[data-mpick]');
  if(m){ state.current = m.dataset.mpick; save(); render(); if(typeof refreshTool === 'function') refreshTool(); $('mPick').hidden = true; return; }
  const pk = $('mPick');
  if(pk && !pk.hidden && !e.target.closest('#mPick') && !e.target.closest('#mLabel')) pk.hidden = true;
});

// ================= earn more: which duties pay best (own rosters, trainer pay left out) =================
function earnData(year){
  const cats = {}, months = [], days = [];
  const add = (k, d, tot) => { const c = cats[k] = cats[k] || {k, n:0, tot:0, H:0}; c.n++; c.tot += tot; c.H += d.H||0; };
  let earlyN = 0, earlySum = 0, buyN = 0, buySum = 0, rMin = Infinity, rMax = 0, nightD = 0, dayD = 0;
  for(const key of Object.keys(state.months).sort()){
    const ro = state.months[key]; if(ro.year !== year) continue;
    const c = PR.compute(ro, state.settings, state.extras);
    let duty = 0, sum = 0, nights = 0;
    for(const d of c.days){
      if(d.extraFix > 0){ buyN++; buySum += d.extraFix; }
      if(d.kind === 'off' || d.kind === 'empty' || d.absence) continue;
      const tot = (d.hourPay||0) + (d.dieta||0) + (d.early||0);   // no trainer pay, no bought day, no sales
      duty++; sum += tot;
      if(d.early > 0){ earlyN++; earlySum += d.early; }
      if(d.hourRate > 0){ rMin = Math.min(rMin, d.hourRate); rMax = Math.max(rMax, d.hourRate); }
      const night = /Night/.test(d.dietaType||''), away = !!d.dietaType;
      if(night){ nights++; nightD = Math.max(nightD, d.dieta||0); } else if(away) dayD = Math.max(dayD, d.dieta||0);
      let k;
      if(d.kind === 'flight') k = night ? 'fn' : away ? 'fd' : 'f0';
      else if(d.kind === 'deadhead') k = night ? 'dn' : 'dd';
      else if(d.kind === 'standby' || d.kind === 'reserve') k = away ? 'on' : 'sb';
      else k = night ? 'on' : away ? 'od' : 'gr';
      add(k, d, tot);
      if(d.kind === 'flight') days.push({date:d.date, route:d.route||d.label||'', tot, H:d.H||0});
    }
    if(duty) months.push({y:ro.year, m:ro.month, duty, sum, nights, T:c.T||0, per:sum/duty});
  }
  return {cats:Object.values(cats).map(c => ({...c, avg:c.tot/c.n, ph:c.H ? c.tot/c.H : 0})).sort((a,b) => b.avg-a.avg),
    months, days:days.sort((a,b) => b.tot-a.tot), earlyN, earlySum, buyN, buySum, rMin:isFinite(rMin)?rMin:0, rMax, nightD, dayD};
}
function renderEarn(){
  const years = [...new Set(Object.values(state.months).map(r => r.year))].sort();
  const cur = state.months[state.current];
  const el = document.getElementById('earn-y');
  const year = +(el && el.value) || (cur ? cur.year : years[years.length-1]);
  if(!year){ pnl(hdr('earn') + `<p class="msg">${t('startText')}</p>`); return; }
  const D = earnData(year);
  if(!D.cats.length){ pnl(hdr('earn') + `<p class="msg">${t('startText')}</p>`); return; }
  const mx = Math.max(...D.cats.map(c => c.avg), 1);
  const catRows = D.cats.map(c => meterRow({t:t('earn_c_'+c.k), v:eur.format(c.avg), p:c.avg/mx*100, tone:c.avg/mx > .75 ? 'ok' : '',
    s:t('earn_perH', {v:eur.format(c.ph), h:fmtH(c.H/c.n)}) + ' · × ' + c.n})).join('');
  const ms = D.months, best = ms.reduce((a,b) => b.sum > a.sum ? b : a), low = ms.reduce((a,b) => b.sum < a.sum ? b : a);
  const mmx = best.sum || 1;
  const mRows = ms.map(r => meterRow({t:nm(r.y, r.m, {month:'long'}) + (r === best ? ' ⭐' : ''), v:eur.format(r.sum), p:r.sum/mmx*100, tone:r === best ? 'ok' : '',
    s:t('earn_mLine', {d:r.duty, n:r.nights, h:fmtH(r.T), p:eur.format(r.per)})})).join('');
  const fn = D.cats.find(c => c.k === 'fn'), fd = D.cats.find(c => c.k === 'fd'), sb = D.cats.find(c => c.k === 'sb'), dn = D.cats.find(c => c.k === 'dn');
  const tips = [];
  if(D.nightD && D.dayD) tips.push(t('earn_t_night', {a:eur.format(D.nightD), b:eur.format(D.dayD), d:eur.format(D.nightD - D.dayD)}));
  if(D.rMax > D.rMin * 1.2) tips.push(t('earn_t_tier', {a:eur.format(D.rMin), b:eur.format(D.rMax)}));
  if(D.earlyN) tips.push(t('earn_t_early', {v:eur.format(+state.settings.earlyCheckin || 30), n:D.earlyN, s:eur.format(D.earlySum)}));
  if(dn) tips.push(t('earn_t_dh', {v:eur.format(dn.avg), h:fmtH(dn.H/dn.n)}));
  if(sb && (fd || fn)) tips.push(t('earn_t_sb', {a:eur.format(sb.avg), b:eur.format((fd || fn).avg)}));
  tips.push(D.buyN ? t('earn_t_buyHad', {n:D.buyN, s:eur.format(D.buySum)}) : t('earn_t_buy'));
  if(ms.length > 1 && best !== low) tips.push(t('earn_t_month', {a:nm(best.y, best.m, {month:'long'}), as:eur.format(best.sum), ad:best.duty, an:best.nights, b:nm(low.y, low.m, {month:'long'}), bs:eur.format(low.sum), bd:low.duty}));
  const top = D.days.slice(0, 5).map(d => `<div class="mrow"><div class="mh"><span>${d.route} <span class="note">${new Date(d.date+'T12:00:00').toLocaleDateString(LOC, {day:'numeric', month:'short'})} · ${fmtH(d.H)}</span></span><b class="num">${eur.format(d.tot)}</b></div></div>`).join('');
  pnl(hdr('earn', t('earn_intro')) + `<label class="note">${t('yr_year')} <select id="earn-y">${years.map(y => `<option${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
    <div class="mgT">${t('earn_h_types')}</div><div class="mg">${catRows}</div>
    <h3 class="wh">${t('earn_h_tips')}</h3><ul class="etips">${tips.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="mgT">${t('earn_h_months')}</div><div class="mg">${mRows}</div>
    <h3 class="wh">${t('earn_h_top')}</h3><div class="mlist">${top}</div>
    <p class="note">${t('earn_note')}</p>`);
}
document.addEventListener('change', e => { if(e.target && e.target.id === 'earn-y') renderEarn(); });
