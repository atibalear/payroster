// ---- Payroster: licences & expiry dates, delays (actual FDP), fatigue, on-board sales log ----

// ---------- 1. licences and expiry dates ----------
const LIC_PRESETS = ['lic_sep','lic_crm','lic_dg','lic_sec','lic_fa','lic_med','lic_cca','lic_tri','lic_pass','lic_id'];
function licList(){ return (state.lic = state.lic || []); }
// expiry dates printed in the IDP roster ("Recurrent Training / Checks"): kept in sync from the newest roster
function mergeChecks(st, checks, rkey){
  if(!checks || !checks.length) return;
  if(st.licFrom && rkey < st.licFrom) return;
  st.licFrom = rkey; st.lic = st.lic || [];
  for(const c of checks){
    const x = st.lic.find(y => y.rcode === c.code);
    if(x) x.exp = c.exp;
    else st.lic.push({ id: 'r' + c.code, rcode: c.code, name: c.name, exp: c.exp });
  }
}
function licDays(iso){ return Math.round((Date.parse(iso+'T12:00') - Date.parse(todayISO()+'T12:00')) / 864e5); }
function licName(x){ return x.key ? t(x.key) : x.name; }
function licAlertsHtml(){
  const soon = licList().filter(x => !x.del && x.exp && licDays(x.exp) <= 60).sort((a,b) => a.exp.localeCompare(b.exp));
  if(!soon.length) return '';
  return `<div class="chips">${soon.map(x => { const d = licDays(x.exp);
    return `<span class="chip ${d < 0 ? 'c-sick' : d <= 30 ? 'c-bez' : ''}" data-tool="lic">${d < 0 ? '⛔' : '⚠'} ${esc(licName(x))}: ${d < 0 ? t('lic_expired') : t('lic_inDays', {n: d})}</span>`; }).join('')}</div>`;
}
function renderLicAlert(){
  const el = $('licAlert'); if(!el) return;
  const h = licAlertsHtml(); el.hidden = !h; el.innerHTML = h ? `<div class="eyebrow">${t('lic_alertT')}</div>${h}` : '';
}
// table of all expiry dates (tab "My details")
function renderLicTable(){
  const el = $('licTable'); if(!el) return;
  const L = licList().filter(x => !x.del && x.exp).sort((a,b) => a.exp.localeCompare(b.exp));
  const dl = iso => new Date(iso+'T12:00').toLocaleDateString(LOC, {day:'numeric', month:'short', year:'numeric'});
  el.innerHTML = `<div class="h2row"><h2 style="margin:0">${t('lic_tableT')}</h2><button class="btn ghost" type="button" data-tool="lic" style="font-size:13px">${t('lic_edit')}</button></div>
    ${L.length ? `<div class="mg">${L.map(x => { const d = licDays(x.exp), tone = d <= 30 ? 'over' : d <= 60 ? 'warn' : 'ok';
      const left = d < 0 ? t('lic_expired') : d > 365 ? t('lic_years', {n: (d/365).toFixed(1).replace('.', LOC.startsWith('en') ? '.' : ',')}) : t('lic_inDays', {n: d});
      return meterRow({t: esc(licName(x)), v: left, p: Math.max(0, Math.min(100, d/365*100)), tone, s: dl(x.exp) + (x.rcode ? ` · <span class="mono">${esc(x.rcode)}</span>` : '')}); }).join('')}</div>`
    : `<p class="note">${t('lic_tableEmpty')}</p>`}`;
}
function renderLic(){
  const L = licList().filter(x => !x.del);
  const used = new Set(L.map(x => x.key).filter(Boolean));
  const rows = L.slice().sort((a,b) => (a.exp||'9').localeCompare(b.exp||'9')).map(x => { const d = x.exp ? licDays(x.exp) : null;
    const cls = d == null ? '' : d < 0 ? 'neg' : d <= 30 ? 'neg' : d <= 60 ? '' : 'pos';
    return `<div class="mrow"><div class="mh nc"><span>${esc(licName(x))}${x.rcode ? ` <span class="chip" style="font-size:11px">${t('lic_fromRoster')}</span>` : ''}</span><button class="btn ghost lic-del" type="button" data-licdel="${x.id}" aria-label="×">×</button></div>
      <div class="row" style="align-items:center;gap:10px"><input type="date" data-licexp="${x.id}" value="${esc(x.exp||'')}">
      <span class="note ${cls}">${d == null ? t('lic_noDate') : d < 0 ? t('lic_expired') : t('lic_inDays', {n: d})}</span></div></div>`; }).join('');
  pnl(hdr('lic', t('lic_intro')) + `<div class="mlist">${rows || `<p class="note">${t('lic_empty')}</p>`}</div>
    <div class="row" style="margin-top:12px;align-items:flex-end">
      <label class="note">${t('lic_add')}<select id="lic-pre"><option value="">—</option>${LIC_PRESETS.filter(k => !used.has(k)).map(k => `<option value="${k}">${t(k)}</option>`).join('')}<option value="_">${t('lic_other')}</option></select></label>
      <input type="text" id="lic-name" placeholder="${t('lic_otherPh')}" hidden>
      <button class="btn" id="lic-addb" type="button">+</button></div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" id="lic-ics" type="button">📅 ${t('lic_ics')}</button></div>
    <p class="note">${t('lic_note')}</p>`);
}
function licIcs(){
  const pad = n => String(n).padStart(2,'0'), now = new Date(), stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T000000Z`;
  const ev = licList().filter(x => x.exp && !x.del).map(x => { const d = x.exp.replace(/-/g,''), n = licName(x).replace(/[,;]/g,' ');
    return ['BEGIN:VEVENT', `UID:lic-${x.id}@payroster`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${t('lic_icsSum',{n})}`,
      'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${n}`,'TRIGGER:-P30D','END:VALARM','BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${n}`,'TRIGGER:-P7D','END:VALARM','END:VEVENT'].join('\r\n'); });
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Payroster//lic//EN', ...ev, 'END:VCALENDAR'].join('\r\n');
}

// ---------- 2. delay: actual FDP more than 30 min over the scheduled one ----------
function delayHtml(d){
  if(!d.legs.length) return '';
  const v = d.delay || '';
  let res = '';
  if(d.delay > 30) res = `<span class="pos">${t('dl_paid', {h: hhmm(d.delayPaid)})}</span>`;
  else if(d.delay > 0) res = `<span class="note">${t('dl_notPaid')}</span>`;
  return `<div class="fdpl"><label class="row" style="align-items:center;gap:8px;margin:0">${t('dl_label')}
    <input type="number" inputmode="numeric" min="0" step="5" data-delay="${d.date}" value="${v}" placeholder="0" style="width:80px"> min</label>
    ${res ? `<div>${res}</div>` : ''}</div>`;
}

// ---------- 5. fatigue ----------
// per day: early start (check-in before 06:00 local), duty touching the night (02:00–05:59 local),
// late finish (after 23:00), short rest (< 12 h at base / 10 h away), long duty (FDP ≥ 11 h)
function fatigueDays(){
  const duties = allDuties(), base = state.settings.base || 'PMI', out = {};
  duties.forEach((x, i) => {
    const hL = ms => { const p = new Intl.DateTimeFormat('en-GB', {timeZone: PR.tzOf(x.st || base), hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(ms)).split(':'); return +p[0] + p[1]/60; };
    const f = { early: false, night: false, late: false, short: false, long: false, pts: 0 };
    const s = hL(x.start), e = x.end ? hL(x.end) : null, len = x.end ? (x.end - x.start) / 36e5 : 0;
    f.early = s < 6 && s >= 2;
    f.night = s < 2 || (x.end && (len > 0 && (s > e || e > 2 && e <= 6 && len > 3)));
    f.late = e != null && (e >= 23 || e < 2);
    f.long = len >= 11;
    const prev = duties[i-1];
    if(prev && prev.end){ const home = (prev.endSt || base) === base && !prev.hotel; f.short = (x.start - prev.end) < Math.max(prev.end - prev.start, (home ? 12 : 10) * 36e5) + 30*60e3; }
    f.pts = (f.early ? 2 : 0) + (f.night ? 3 : 0) + (f.late ? 1 : 0) + (f.short ? 2 : 0) + (f.long ? 2 : 0);
    out[x.date] = { ...f, x, len };
  });
  return out;
}
// A week is shown as HIGH when the roster matches EASA fatigue risk factors:
//  · ORO.FTL.210: more than 50 h of duty in the 7 days (limit 60 h)
//  · CS FTL.1.235(b) disruptive schedules: 3 or more early starts (before 06:00) or late finishes (after 23:00)
//  · WOCL (02:00–05:59): 2 or more duties touching the night
//  · ORO.FTL.235: a rest shorter than the minimum, or no 36 h recovery rest with 2 local nights in the week
//  · 2 or more FDPs of 11 h or more
function renderFat(){
  const ro = state.months[state.current]; if(!ro){ pnl(hdr('fat') + `<p class="msg">${t('startText')}</p>`); return; }
  const F = fatigueDays(), duties = allDuties(), c = PR.compute(ro, state.settings, state.extras), base = state.settings.base || 'PMI';
  const hLoc = (ms, st) => { const p = new Intl.DateTimeFormat('en-GB', {timeZone: PR.tzOf(st || base), hour:'2-digit', hourCycle:'h23'}).format(new Date(ms)); return +p; };
  // end of the last recovery rest before each duty
  const recov = [];
  for(let j = 0; j < duties.length - 1; j++){
    const gs = duties[j].end, ge = duties[j+1].start; if(!gs || ge - gs < 36*36e5) continue;
    let nights = 0; for(let x = gs; x < ge; x += 36e5) if(hLoc(x, duties[j].endSt) === 3) nights++;
    if(nights >= 2) recov.push(ge);
  }
  const first = duties.length ? duties[0].start : 0;
  const lastRecovery = x => { let r = first; for(const g of recov) if(g <= x.start) r = g; return r; };
  const weeks = [];
  for(let i = 0; i < c.days.length; i += 7){
    const ds = c.days.slice(i, i+7), a = ds[0].date, b = ds[ds.length-1].date;
    const fs = ds.map(d => F[d.date]).filter(Boolean);
    const hrs = fs.reduce((x, f) => x + f.len, 0);
    const early = fs.filter(f => f.early || f.late).length, night = fs.filter(f => f.night).length, short = fs.filter(f => f.short).length, long = fs.filter(f => f.long).length;
    // recovery rest (ORO.FTL.235 d): never more than 168 h between two rests of 36 h with 2 local nights
    const noRecov = duties.some(x => x.date >= a && x.date <= b && x.end && x.end - lastRecovery(x) > 168*36e5);
    const why = [];
    if(hrs > 50) why.push(t('fe_duty', {h: hhmm(hrs)}));
    if(early >= 3) why.push(t('fe_disr', {n: early}));
    if(night >= 2) why.push(t('fe_wocl', {n: night}));
    if(short >= 1) why.push(t('fe_rest', {n: short}));
    if(noRecov) why.push(t('fe_recov'));
    if(long >= 2) why.push(t('fe_long', {n: long}));
    weeks.push({ a, b, hrs, n: fs.length, why, hi: why.length > 0 });
  }
  const dd = iso => new Date(iso+'T12:00').toLocaleDateString(LOC, {day:'numeric', month:'short'});
  const hi = weeks.filter(w => w.hi);
  const sc = sleepCfg();
  const slp = `<div class="form" style="margin:0 0 10px"><label>${t('sl_hours')}<select id="sl-h">${[6,6.5,7,7.5,8,8.5,9].map(v => `<option value="${v}"${v===sc.h?' selected':''}>${String(v).replace('.', ',')} h</option>`).join('')}</select></label>
    <label>${t('sl_prep')}<select id="sl-p">${[30,45,60,75,90].map(v => `<option value="${v}"${v===sc.prep?' selected':''}>${v} min</option>`).join('')}</select></label></div>`;
  pnl(hdr('fat', t('fat_intro2')) + slp + (hi.length ? '' : `<p class="msg" style="background:var(--pay-soft);color:var(--pay)">${t('fat_noneHi')}</p>`) +
    `<div class="mlist">${weeks.map(w => `<div class="mrow"><div class="mh nc">${dd(w.a)} – ${dd(w.b)}${w.hi ? `<span class="chip fatlvl-hi">⚠ ${t('fat_hiShort')}</span>` : ''}</div>
      <div class="note">${t('fat_weekS', {h: hhmm(w.hrs), d: w.n})}</div>
      ${w.hi ? `<ul class="fatwhy">${w.why.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>
    <h3 class="wh">${t('fat_daysAll')}</h3>
    <div class="mlist">${c.days.filter(d => F[d.date] && F[d.date].len > 0).map(d => { const f = F[d.date];
      const lvl = f.pts >= 5 || (f.night && f.pts >= 3) ? 'hi' : f.pts >= 2 ? 'mid' : 'lo';
      const tags = ['early','night','late','short','long'].filter(k => f[k]).map(k => `<span class="chip">${t('fat_'+k)}</span>`).join('');
      return `<div class="mrow"><div class="mh nc">${new Date(d.date+'T12:00').toLocaleDateString(LOC,{weekday:'short', day:'numeric'})} · ${esc(d.route||d.label||'')}
        <span class="chip fatlvl-${lvl}">${lvl==='hi'?'⚠ ':''}${t('fat_'+lvl)}</span></div>${tags ? `<div class="chips">${tags}</div>` : ''}</div>`; }).join('') || `<p class="note">${t('fat_none')}</p>`}</div>
    <p class="note">${t('fat_note2')}</p>`);
}
// ---------- 6. on-board sales log ----------
function salesOfMonth(k){ const log = (state.salesLog||{})[k] || {}; return Object.values(log).reduce((a, v) => a + (+v||0), 0); }
function applySalesLog(k){
  const rate = +state.settings.salesRate || 0, sum = salesOfMonth(k);
  const ex = state.extras[k] = state.extras[k] || {};
  if(ex.salesSlip) return;                       // the payslip wins
  if(ex.sales != null && !ex.salesLog) return;   // typed by hand wins too
  if(sum > 0){ ex.sales = PR.r2(rate ? sum * rate / 100 : sum); ex.salesLog = true; }
  else if(ex.salesLog){ ex.sales = null; ex.salesLog = false; }
}
function salesSumTxt(ro){
  const k = key(ro), rate = state.settings.salesRate || '', sum = salesOfMonth(k), ex = state.extras[k] || {}, comm = rate ? sum * rate / 100 : sum;
  return (rate ? t('sl_sumR', {s: eur.format(sum), r: rate, c: eur.format(comm), m: monthName(ro.year, ro.month)}) : t('sl_sum', {s: eur.format(sum), m: monthName(ro.year, ro.month)}))
    + (ex.salesSlip ? ' ' + t('sl_slipWins', {v: eur.format(ex.sales)}) : '');
}
function renderSales(){
  const ro = state.months[state.current]; if(!ro){ pnl(hdr('sales') + `<p class="msg">${t('startText')}</p>`); return; }
  const k = key(ro), log = (state.salesLog||{})[k] || {}, rate = state.settings.salesRate || '';
  const c = PR.compute(ro, state.settings, state.extras), sum = salesOfMonth(k), ex = state.extras[k] || {};
  const rows = c.days.filter(d => d.legs.some(l => l.type==='flt')).map(d => `<div class="mrow" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div style="min-width:0"><div class="mh nc" style="display:block">${new Date(d.date+'T12:00').toLocaleDateString(LOC,{weekday:'short', day:'numeric'})}</div><div class="note">${esc(d.route)}</div></div>
      <input type="text" inputmode="decimal" data-sale="${d.date}" value="${log[d.date] ?? ''}" placeholder="0,00" style="width:110px;text-align:right"></div>`).join('');
  pnl(hdr('sales', t('sl_intro')) + `<label class="note">${t('sl_rate')} <input type="text" inputmode="decimal" id="sl-rate" value="${rate}" placeholder="—" style="width:80px"> %</label>
    <p class="msg" id="sl-sum">${salesSumTxt(ro)}</p>
    <div class="mlist">${rows}</div><p class="note">${t('sl_note')}</p>`);
}

// events
document.addEventListener('change', e => {
  const el = e.target;
  if(el.dataset.licexp){ const x = licList().find(y => y.id === el.dataset.licexp); if(x){ x.exp = el.value || ''; save(); renderLic(); renderLicAlert(); renderLicTable(); } return; }
  if(el.id === 'lic-pre'){ $('lic-name').hidden = el.value !== '_'; return; }
  if(el.dataset.delay){ const k = el.dataset.delay; state.extras[k] = state.extras[k] || {}; const v = parseInt(el.value, 10);
    if(v > 0) state.extras[k].delay = v; else delete state.extras[k].delay; save(); render(); return; }
  if(el.dataset.sale){ const d = el.dataset.sale, k = d.slice(0,7), v = String(el.value).trim();
    state.salesLog = state.salesLog || {}; const log = state.salesLog[k] = state.salesLog[k] || {};
    if(v === '') delete log[d]; else log[d] = parseFloat(/,/.test(v) ? v.replace(/\./g,'').replace(',','.') : v) || 0;
    applySalesLog(k); save(); render(); const ro = state.months[k]; if(ro && $('sl-sum')) $('sl-sum').innerHTML = salesSumTxt(ro); return; }
  if(el.id === 'sl-rate'){ const v = String(el.value).trim().replace(',','.'); state.settings.salesRate = v ? (parseFloat(v) || '') : '';
    applySalesLog(state.current); save(); render(); renderSales(); return; }
});
document.addEventListener('click', async e => {
  const id = e.target.id, el = e.target;
  if(id === 'lic-addb'){ const pre = $('lic-pre').value; if(!pre) return;
    const x = { id: Date.now().toString(36), exp: '' };
    if(pre === '_'){ const n = $('lic-name').value.trim(); if(!n) return; x.name = n; } else x.key = pre;
    licList().push(x); save(); renderLic(); return; }
  if(el.dataset && el.dataset.licdel){ const x = licList().find(y => y.id === el.dataset.licdel);
    if(x && x.rcode) x.del = true; else state.lic = licList().filter(y => y.id !== el.dataset.licdel);
    save(); renderLic(); renderLicAlert(); return; }
  if(id === 'lic-ics'){ await giveFile('payroster-caducidades.ics', licIcs(), 'text/calendar'); return; }

});
