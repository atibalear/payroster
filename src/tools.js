// ---- Payroster tools: payslip check, what-if, calendar, FTL, days off, year summary, backup ----
// Shares the page's globals (state, t, eur, n2, hhmm, PR, monthName, key, prevKey, save, render…).

const TOOLS = ['map','lay','check','sim','earn','cal','ftl','fat','vac','lic','sales','year','wrap','cmp','fam','backup'];
let toolOpen = null, simDate = null;
const TOOL_CATS = [['fly', ['map','lay','cal','ftl','fat']], ['money', ['check','earn','sim','year','sales','wrap']], ['me', ['vac','fam','lic','cmp','backup']]];

const TOOL_ICON = {
  map:'<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>',
  lay:'<rect x="4" y="7.5" width="16" height="12" rx="2.5"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M4 12.5h16M10.5 12.5v1.5h3v-1.5"/>',
  check:'<path d="M7 3.5h8l3.5 3.5v13.5h-11.5z"/><path d="M14.5 3.5V7h4"/><path d="m9.5 13.5 2 2 4-4.5"/>',
  earn:'<circle cx="12" cy="12" r="8.5"/><path d="M15 9.2a3.6 3.6 0 1 0 0 5.6M7.5 11h5M7.5 13.2h5"/>',
  sim:'<path d="M4 18 9.5 12l3.5 3.5L20 8"/><path d="M15 8h5v5"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M12 13v4M10 15h4"/>',
  ftl:'<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
  vac:'<path d="M12 21v-9"/><path d="M4 11a8 8 0 0 1 16 0z"/><path d="M8 21h8"/>',
  year:'<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="7" rx=".8"/><rect x="10.5" y="7" width="3" height="11" rx=".8"/><rect x="15.5" y="4" width="3" height="14" rx=".8"/>',
  wrap:'<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  cmp:'<circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.2c2.5-.3 4.8 1.2 5.5 4.3"/>',
  fam:'<path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
  lic:'<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.5 1.4-2.2 2.5-2.2s2 .7 2.5 2.2M14 10h3.5M14 13.5h3.5"/>',
  fat:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sales:'<path d="M5 7h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8z"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7"/>',
  backup:'<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.6a4 4 0 0 1-.5 9.9H7z"/><path d="m12 11v5M9.8 13.2 12 11l2.2 2.2"/>'
};
function renderToolbar(){
  const bar = $('toolbar'); if(!bar) return;
  const tile = k => `<button class="tile${toolOpen===k?' on':''}" type="button" data-tool="${k}"><svg viewBox="0 0 24 24">${TOOL_ICON[k]||''}</svg>${t('tool_'+k)}</button>`;
  const seen = new Set(TOOL_CATS.flatMap(c => c[1]));
  const cats = TOOL_CATS.map(c => [c[0], c[1].filter(k => TOOLS.includes(k))]);
  const rest = TOOLS.filter(k => !seen.has(k)); if(rest.length) cats[cats.length-1][1].push(...rest);
  bar.innerHTML = cats.filter(c => c[1].length).map(([c, ks]) => `<div class="tcat"><h3>${t('tc_'+c)}</h3><p>${t('tc_'+c+'S')}</p><div class="toolgrid">${ks.map(tile).join('')}</div></div>`).join('');
}
function setTab(tab){
  document.body.dataset.tab = tab;
  document.querySelectorAll('[data-tabgo]').forEach(b => b.classList.toggle('on', b.dataset.tabgo === tab));
  try{ sessionStorage.setItem('pr.tab', tab); }catch(e){}
  // the 3D route map only draws while it can be seen
  if(typeof mapDispose === 'function' && toolOpen === 'map' && !mm){ if(tab !== 'tools') mapDispose(); else if(!mapG3 && !mapFlat && $('g3m')) renderMap(); }
}
// A tool opens as its own screen ("‹ Tools" goes back; so does the iPhone back swipe)
function openTool(k){
  setTab('tools');
  const was = toolOpen;
  toolOpen = k;
  renderToolbar();
  const p = $('toolPanel');
  p.hidden = false; document.body.dataset.toolopen = k;
  if(toolOpen !== 'map' && typeof mapDispose === 'function') mapDispose();
  TOOL_FN()[toolOpen]();
  if(was !== k){ window.scrollTo(0, 0); try{ if(!(history.state && history.state.tool)) history.pushState({tool:k}, ''); else history.replaceState({tool:k}, ''); }catch(e){} }
}
function closeTool(){
  if(typeof mapDispose === 'function') mapDispose();
  toolOpen = null; delete document.body.dataset.toolopen;
  const p = $('toolPanel'); p.hidden = true; p.innerHTML = '';
  renderToolbar(); window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => { if(toolOpen) closeTool(); });
function refreshTool(){ if(toolOpen) TOOL_FN()[toolOpen](); }
const TOOL_FN = () => ({check:renderCheck, sim:renderSim, earn:renderEarn, cal:renderCal, ftl:renderFtl, vac:renderVac, year:renderYear, wrap:renderWrap, map:renderMap, lay:renderLay, lic:renderLic, fat:renderFat, sales:renderSales, cmp:renderCmp, fam:renderFam, backup:renderBackup});
const pnl = html => { $('toolPanel').innerHTML = html; };
const hdr = (k, sub) => `<div class="eyebrow">${t('tool_'+k)}</div>${sub?`<p class="note" style="margin:6px 0 12px">${sub}</p>`:''}`;
const fmtH = h => hhmm(Math.max(0,h||0));
const nm = (y,m,o) => monthName(y,m,o||{month:'long',year:'numeric'});
const kOf = (y,m) => y+'-'+String(m).padStart(2,'0');
const prevYM = (y,m) => m===1 ? [y-1,12] : [y,m-1];
const nextYM = (y,m) => m===12 ? [y+1,1] : [y,m+1];

// ================= 1. payslip check =================
function slipBuckets(lines){
  const sum = (f, fld='dev') => lines.filter(f).reduce((a,l)=>a+(+l[fld]||0),0);
  const L = l => (l.label||'').toLowerCase();
  const isH = l => /^(tiempo de vuelo|tpo de vuelo|tpo vuelo)/.test(L(l));
  const isAdd = l => /adicion/.test(L(l));
  const viaje = l => /^viaje/.test(L(l));
  const dType = l => (/inter/.test(L(l)) ? 'intl' : 'nat') + (/con pern/.test(L(l)) ? 'Night' : 'Day');
  const counts = {intlNight:0,intlDay:0,natNight:0,natDay:0}, dAmt = {intlNight:0,intlDay:0,natNight:0,natDay:0};
  lines.filter(viaje).forEach(l => { const k = dType(l); dAmt[k] += +l.dev||0; counts[k] += Math.round((+l.dev||0) / PR.DIETA[k]); });
  const known = l => l.code==='1000' || isOneOff(l) || /uniforme|formaci[oó]n de cabina|compra|comisi|asesoramiento|early|check|parada nocturna|gastos de viaje/.test(L(l)) || isH(l) || viaje(l) || /^\//.test(l.code);
  return {
    base: sum(l=>l.code==='1000'), uniform: sum(l=>/uniforme/.test(L(l))), trainer: sum(l=>/formaci[oó]n de cabina/.test(L(l))),
    buy: sum(l=>/compra/.test(L(l))), buyN: sum(l=>/compra/.test(L(l)),'units'),
    hF: sum(l=>isH(l)&&!isAdd(l),'units'), hA: sum(l=>isH(l)&&isAdd(l),'units'), hours: sum(isH),
    early: sum(l=>/early|check|parada nocturna/.test(L(l))), sales: sum(l=>/comisi/.test(L(l))),
    fiscal: sum(l=>/asesoramiento/.test(L(l))), oneOff: sum(isOneOff), ingCta: sum(l=>/ingreso a cuenta/.test(L(l)),'ded'),
    ss: sum(l=>/^\/3[5-9]\d/.test(l.code),'ded'), irpf: sum(l=>l.code==='/401','ded'),
    dietas: Object.values(dAmt).reduce((a,b)=>a+b,0), dCounts: counts,
    other: lines.filter(l=>!known(l) && !/ingreso a cuenta/.test(L(l)))
  };
}
function renderCheck(kSel){
  const ro = state.months[state.current];
  const keys = Object.keys(state.slips||{}).filter(k => (state.slips[k]||{}).lines).sort().reverse();
  const k = kSel || (ro && (state.slips||{})[key(ro)] && state.slips[key(ro)].lines ? key(ro) : keys[0]);
  if(!k){ pnl(hdr('check', t('chk_intro')) + `<p class="msg">${t('chk_needSlip')}</p><label class="btn" for="pdfIn" style="display:inline-block">${t('su_upload')}</label>`); return; }
  const [y,m] = k.split('-').map(Number), [py,pm] = prevYM(y,m), prev = state.months[kOf(py,pm)];
  const pick = `<label class="note">${t('chk_month')} <select id="chk-k">${keys.map(x=>{const [a,b]=x.split('-').map(Number);return `<option value="${x}"${x===k?' selected':''}>${nm(a,b)}</option>`;}).join('')}</select></label>`;
  if(!prev){ pnl(hdr('check', t('chk_intro')) + pick + `<p class="msg err">${t('chk_needPrev',{m:nm(y,m),p:nm(py,pm)})}</p>`); return; }
  const {rows, bad, net, P, R} = checkData(k);
  const summary = bad.length ? `<p class="msg err">${t('chk_bad',{n:bad.length})} ${bad.map(r=>`<b>${esc(r.lbl)}</b>`).join(', ')}.</p>` : `<p class="msg" style="background:var(--pay-soft);color:var(--pay)">${t('chk_ok',{d:eur.format(net-P.net)})}</p>`;
  const others = R.other.length ? `<p class="note">${t('chk_other')}: ${R.other.map(l=>`${esc(l.label)} ${eur.format((l.dev||0)-(l.ded||0))}`).join(' · ')}</p>` : '';
  const mail = bad.length || Math.abs(net-P.net) >= 5 ? `<div class="mailbox"><div class="row" style="align-items:flex-end">
      <label class="note">${t('mail_lang')} <select id="mail-l">${['es','en'].map(l=>`<option value="${l}"${l===(lang==='es'||lang==='ca'?'es':'en')?' selected':''}>${I18N.names[l]}</option>`).join('')}</select></label>
      <button class="btn" id="mail-go" type="button" data-k="${k}">✉ ${t('mail_btn')}</button></div><div id="mail-out"></div></div>` : '';
  pnl(hdr('check', t('chk_intro')) + pick + summary + `<div class="tablewrap"><table class="slip chk"><tr class="sec"><td>${t('chk_concept')}</td><td>${t('chk_colReal')}</td><td>App</td><td>${t('chk_colDiff')}</td></tr>
    ${rows.map(r=>{ const st = r.ok ? '' : r.small ? 'meh' : 'bad';
      return `<tr class="${st}"><td>${esc(r.lbl)}</td><td>${r.real}</td><td>${r.app}</td><td>${r.ok?'✓':esc(r.txt)}</td></tr>${!r.ok&&r.hint?`<tr class="hint ${st}"><td colspan="4">${r.hint}</td></tr>`:''}`; }).join('')}</table></div>` + others + mail);
}
// the comparison of one payslip (k = 'YYYY-MM') with the app, in the current language
function checkData(k){
  const [y,m] = k.split('-').map(Number), [py,pm] = prevYM(y,m), prev = state.months[kOf(py,pm)];
  const s = state.settings, c = PR.compute(prev, s, state.extras), P = slipFor(c, s, y, m), v = P.v, R = slipBuckets(state.slips[k].lines);
  const rows = [];
  const money = (lbl, real, app, hint, days) => rows.push({lbl, real:eur.format(real), app:eur.format(app), d:real-app, ok:Math.abs(real-app)<1, txt:eur.format(real-app), hint, days});
  const daysOf = f => c.days.filter(f).map(d=>d.day).join(', ');
  money(t('slip_base',{r:rankName(s.rank),l:P.level}), R.base, P.baseSalary, t('chk_hBase'));
  if(R.trainer || P.allowTotal) money(t('slip_trainer'), R.trainer, P.allowTotal, t('chk_hTrainer',{d:daysOf(d=>d.isTrain||d.isCTday)||'—'}), daysOf(d=>d.isTrain||d.isCTday));
  money(t('slip_uniform'), R.uniform, P.uniform);
  if(R.oneOff || P.oneOff) money(t('slip_oneOff'), R.oneOff, P.oneOff);
  if(P.lumpSum) money(t('slip_lump'), R.lump || 0, P.lumpSum, R.lump ? '' : t('chk_hLump'));
  // hours
  const appF = (v.tiers||[]).reduce((a,x)=>a+x.hF,0), appA = (v.tiers||[]).reduce((a,x)=>a+x.hA,0);
  rows.push({lbl:t('chk_hoursF'), real:fmtH(R.hF)+' h', app:fmtH(appF)+' h', d:R.hF-appF, ok:Math.abs(R.hF-appF)<0.1, small:Math.abs(R.hF-appF)<2, txt:(R.hF-appF>=0?'+':'−')+fmtH(Math.abs(R.hF-appF))+' h', hint:t('chk_hFdp')});
  rows.push({lbl:t('chk_hoursA'), real:fmtH(R.hA)+' h', app:fmtH(appA)+' h', d:R.hA-appA, ok:Math.abs(R.hA-appA)<0.1, txt:(R.hA-appA>=0?'+':'−')+fmtH(Math.abs(R.hA-appA))+' h', hint:t('chk_hAdd')});
  money(t('chk_hoursPay'), R.hours, v.hourPay+v.topUp, t('chk_hHoursPay')); rows[rows.length-1].small = Math.abs(rows[rows.length-1].d) < 15;
  // per diems by type
  for(const dt of ['intlNight','intlDay','natNight','natDay']){
    const r = R.dCounts[dt], a = (v.dietaCounts||{})[dt]||0; if(!r && !a) continue;
    rows.push({lbl:t('d_'+dt), real:'× '+r, app:'× '+a, d:r-a, ok:r===a, txt:(r-a>0?'+':'')+(r-a),
      hint: r<a ? t('chk_hDietaLess',{d:daysOf(d=>d.dietaType===dt)}) : r>a ? t('chk_hDietaMore') : '', days: daysOf(d=>d.dietaType===dt)});
  }
  if(R.early || v.early) money('Early check-in', R.early, v.early, R.early<v.early ? t('chk_hEarly',{d:daysOf(d=>d.early>0)}) : '', daysOf(d=>d.early>0));
  if(R.buy || v.extraFix) money(t('slip_buy'), R.buy, v.extraFix, R.buy<v.extraFix ? t('chk_hBuy',{d:daysOf(d=>d.extraFix>0)}) : '', daysOf(d=>d.extraFix>0));
  money(t('slip_sales'), R.sales, v.sales, !v.sales && R.sales ? t('chk_hSales',{p:nm(py,pm)}) : '');
  if(R.fiscal || P.fiscalAid) money(t('slip_fiscalAid'), R.fiscal, P.fiscalAid, !s.joined ? t('askJoined') : '');
  money(t('slip_ss'), R.ss, P.ss, t('chk_hTax')); rows[rows.length-1].small = Math.abs(rows[rows.length-1].d) < 5;
  money(t('slip_irpf'), R.irpf, P.irpf, t('chk_hTax')); rows[rows.length-1].small = Math.abs(rows[rows.length-1].d) < 5;
  const net = state.slips[k].net;
  money(t('slip_net'), net, P.net, ''); rows[rows.length-1].small = Math.abs(rows[rows.length-1].d) < 10;
  const bad = rows.filter(r=>!r.ok && !r.small && r.lbl!==t('slip_net') && r.lbl!==t('slip_ss') && r.lbl!==t('slip_irpf') && r.lbl!==t('chk_hoursPay'));
  return {rows, bad, net, P, R, c, y, m, py, pm};
}

// ---- e-mail to HR about a payslip that doesn't match ----
const MAIL = {
  es: { subj: 'Revisión de la nómina de {m} – {n} ({id})',
    hi: 'Hola,', intro: 'He revisado mi nómina de {m} con mi roster de {p} y creo que hay conceptos que no cuadran:',
    line: '- {l}: en la nómina {r}, según el roster {a} (diferencia {d}).', days: ' Días: {d}.',
    net: 'El líquido de la nómina es {r}; según mis cálculos con el convenio debería ser aproximadamente {a} (diferencia {d}).',
    netOnly: 'El líquido de la nómina es {r}; según mis cálculos con el convenio y mi roster de {p} debería ser aproximadamente {a} (diferencia {d}). No encuentro un concepto concreto, ¿podríais revisarla?',
    ask: '¿Podríais revisarlo, por favor? Si lo necesitáis, os envío el roster de {p}.', bye: 'Gracias y un saludo,', idl: 'Nº de personal: {id}' },
  en: { subj: 'Payslip check {m} – {n} ({id})',
    hi: 'Hello,', intro: 'I have checked my {m} payslip against my {p} roster and I think some items don’t match:',
    line: '- {l}: payslip {r}, roster {a} (difference {d}).', days: ' Days: {d}.',
    net: 'The net pay on the payslip is {r}; by my calculation under the CLA it should be about {a} (difference {d}).',
    netOnly: 'The net pay on the payslip is {r}; by my calculation under the CLA and my {p} roster it should be about {a} (difference {d}). I can’t find one specific item, could you please check it?',
    ask: 'Could you please check this? I can send you my {p} roster if needed.', bye: 'Thank you and kind regards,', idl: 'Employee number: {id}' }
};
function withLang(l, fn){ const old = lang; setLang(l); try{ return fn(); } finally { setLang(old); } }
function buildMail(k, L){
  return withLang(L, () => {
    const D = checkData(k), M = MAIL[L], f = (s,v) => s.replace(/\{(\w+)\}/g, (x,y)=>v[y]!=null?v[y]:x);
    const ro = state.months[kOf(D.py,D.pm)] || {};
    const parts = String(ro.crew||'').split(',').map(x=>x.trim()).filter(Boolean);
    const name = parts.length > 1 ? parts[1] + ' ' + parts[0] : (parts[0]||'');
    const id = ro.crewId ? String(+ro.crewId) : '';
    const mes = nm(D.y,D.m), pmes = nm(D.py,D.pm), dn = D.net - D.P.net;
    const sgn = v => (v>0?'+':'') + eur.format(v);
    const lines = D.bad.map(r => f(M.line,{l:r.lbl, r:r.real, a:r.app, d:r.txt.replace(/^(?=\d)/,'+')}) + (r.days ? f(M.days,{d:r.days}) : ''));
    const body = [M.hi, '',
      ...(lines.length ? [f(M.intro,{m:mes,p:pmes}), '', ...lines, '', f(M.net,{r:eur.format(D.net), a:eur.format(D.P.net), d:sgn(dn)})]
                       : [f(M.netOnly,{r:eur.format(D.net), a:eur.format(D.P.net), d:sgn(dn), p:pmes})]),
      '', f(M.ask,{p:pmes}), '', M.bye, name, id ? f(M.idl,{id}) : ''].join('\n').trim();
    return { subject: f(M.subj,{m:mes, n:name, id}).replace(/ \(\)$/,''), body };
  });
}

// ================= 2. what-if simulator =================
const parseHM = s => { s = String(s||'').trim().replace(',', '.'); if(!s) return 0; const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? +m[1] + m[2]/60 : (parseFloat(s)||0); };
function renderSim(result){
  const ro = state.months[state.current]; if(!ro){ pnl(hdr('sim')+`<p class="msg">${t('startText')}</p>`); return; }
  const s = state.settings, c = PR.compute(ro, s, state.extras);
  if(!simDate || !c.days.find(d=>d.date===simDate)) simDate = (c.days.find(d=>d.date>=todayISO()) || c.days[0]).date;
  const d = c.days.find(x=>x.date===simDate);
  const opt = c.days.map(x=>`<option value="${x.date}"${x.date===simDate?' selected':''}>${x.day} · ${esc(x.route||x.label||kind(x.kind).n)}</option>`).join('');
  const dv = (id, v) => `value="${esc(v)}" id="${id}"`;
  pnl(hdr('sim', t('sim_intro')) + `<div class="form" style="margin-top:0">
      <label>${t('sim_day')}<select id="sim-date">${opt}</select></label>
      <label>${t('sim_now')}<input type="text" readonly value="${esc((d.route||d.label||kind(d.kind).n) + ' · ' + hhmm(d.H)+' h · '+eur.format(d.total))}"></label>
      <label>${t('sim_action')}<select id="sim-act"><option value="off">${t('sim_off')}</option><option value="duty">${t('sim_duty')}</option></select></label>
      <label>FDP (h:mm)<input type="text" inputmode="decimal" placeholder="8:30" ${dv('sim-F', hhmm(d.F))}></label>
      <label>${t('addDuty')} (h:mm)<input type="text" inputmode="decimal" placeholder="0:30" ${dv('sim-A', hhmm(d.A))}></label>
      <label>${t('perDiems')}<select id="sim-d"><option value="">${t('no')}</option>${['intlDay','intlNight','natDay','natNight'].map(k=>`<option value="${k}"${d.dietaType===k?' selected':''}>${t('d_'+k)} · ${n2.format(PR.DIETA[k])} €</option>`).join('')}</select></label>
      <label>${t('dayBought')}<select id="sim-b"><option value="">${t('no')}</option><option value="full"${d.buy==='full'?' selected':''}>${t('full')}</option><option value="half"${d.buy==='half'?' selected':''}>${t('half')}</option></select></label>
      <label class="chk"><input type="checkbox" id="sim-e"${d.early?' checked':''}> ${t('earlyOff')} (${eur.format(s.earlyCheckin)})</label>
      ${s.isTrainer?`<label class="chk"><input type="checkbox" id="sim-t"${d.isTrain?' checked':''}> ${t('sim_train')}</label>`:''}
      <div class="wide"><button class="btn" id="sim-go" type="button">${t('sim_calc')}</button></div>
    </div><div id="sim-out">${result||''}</div>`);
}
function runSim(){
  const ro = state.months[state.current], s = state.settings;
  const act = $('sim-act').value;
  const sim = act==='off' ? { F:0, A:0, dieta:null, early:false, buy:null, train:false }
    : { F:parseHM($('sim-F').value), A:parseHM($('sim-A').value), dieta:$('sim-d').value||null, early:$('sim-e').checked, buy:$('sim-b').value||null, train: $('sim-t') ? $('sim-t').checked : false };
  const ex2 = JSON.parse(JSON.stringify(state.extras||{})); ex2[simDate] = Object.assign({}, ex2[simDate]||{}, {sim});
  const a = PR.compute(ro, s, state.extras), b = PR.compute(ro, s, ex2);
  const [ny,nmn] = nextYM(ro.year, ro.month), Na = slipFor(a, s, ny, nmn), Nb = slipFor(b, s, ny, nmn);
  const tier = x => x.T>110?3:x.T>70?2:1, dv = b.variable-a.variable, dn = Nb.net-Na.net;
  const sign = x => (x>=0?'+':'−')+eur.format(Math.abs(x));
  $('sim-out').innerHTML = `<dl class="sumbox" style="margin-top:14px">
    <dt>${t('variableIn',{m:nm(ro.year,ro.month,{month:'long'})})}</dt><dd>${eur.format(a.variable)} → <b>${eur.format(b.variable)}</b></dd>
    <dt>${t('dutyTime',{h:fmtH(a.T)})} → ${fmtH(b.T)} h</dt><dd>${t('tierN',{n:tier(a)})} → ${t('tierN',{n:tier(b)})}</dd>
    <dt class="netrow">${t('sim_net',{m:nm(ny,nmn,{month:'long'})})}</dt><dd class="netrow">${sign(dn)}</dd></dl>
    <p class="note">${t('sim_result',{v:sign(dv),n:sign(dn)})}${tier(a)!==tier(b)?' '+t('sim_tier',{a:tier(a),b:tier(b)}):''}</p>`;
}

// ================= 3. calendar (.ics) =================
function icsEsc(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function utcStamp(dateISO, hhmm, plusDays){ const [y,m,d] = dateISO.split('-').map(Number); const dt = new Date(Date.UTC(y,m-1,d+(plusDays||0), Math.floor(+hhmm/100), +hhmm%100)); return dt.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z'; }
function addMin(stamp, min){ const d = new Date(stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z')); d.setUTCMinutes(d.getUTCMinutes()+min); return d.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z'; }
function buildIcs(months, o){
  const ev = [], me = (state.months[state.current]||{}).crew||'';
  for(const ro of months){
    const c = PR.compute(ro, state.settings, state.extras);
    let open = null;
    const close = (end) => { if(!open) return; open.end = end || open.end; ev.push(open); open = null; };
    for(const d of c.days){
      const raw = ro.days.find(x=>x.date===d.date) || {events:[]};
      // a duty only carries over midnight when the next day starts with its remaining legs
      if(open && !(raw.events[0] && (raw.events[0].type==='flt' || raw.events[0].type==='dh' || raw.events[0].type==='co'))) close();
      for(const e of raw.events){
        if(e.type==='ci' || e.type==='su'){ close(); open = { start: utcStamp(d.date, e.t1), legs:[], date:d.date, d, pk: pickupMs(d.date, raw.events, utcAt(d.date, e.t1)) }; continue; }
        if(e.type==='flt' || e.type==='dh'){
          if(!open) open = { start: utcStamp(d.date, e.t1), legs:[], date:d.date, d };
          open.legs.push(e); open.end = utcStamp(d.date, e.t2, +e.t2 < +e.t1 ? 1 : 0); open.hotel = d.hotel || open.hotel;
          if(!open.crew && d.crew && d.crew.length) open.crew = d.crew; continue; }
        if(e.type==='co'){ if(open) close(utcStamp(d.date, e.t1)); continue; }
        if(e.type==='code'){
          const off = /^(O_|OFF|FREI|U$|SU$|U_)/.test(e.code);
          if(off){ if(o.off && !open) ev.push({ allDay:d.date, title:e.code + (kind(d.kind).n?` · ${kind(d.kind).n}`:''), d }); continue; }
          if(open){ open.extra = (open.extra||[]).concat(e.code); continue; }
          if(/^TAXI/.test(e.code)) continue;
          if(e.t1 && e.t2) ev.push({ pk: pickupMs(d.date, raw.events, utcAt(d.date, e.t1)), start: utcStamp(d.date, e.t1), end: utcStamp(d.date, e.t2, +e.t2 <= +e.t1 ? 1 : 0), title: e.label || e.code, loc: e.st, d, gcrew: d.gcrew });
        }
      }
    }
    close();
  }
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Payroster//Roster//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Payroster'];
  const now = new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  for(const e of ev){
    const legs = e.legs||[];
    const title = legs.length ? (legs.some(l=>l.type==='flt') ? '' : 'DH ') + [legs[0].dep, ...legs.map(l=>l.arr)].join('–') : e.title;
    const desc = [];
    legs.forEach(l => desc.push(`${l.type==='dh'?'DH ':''}${l.flight} ${l.dep} ${t4(l.t1)}–${t4(l.t2)} ${l.arr} (UTC)`));
    if(e.pk) desc.push('🚐 ' + t('td_pick', {h: localHM(e.pk, (legs[0] && legs[0].dep) || e.loc)}));
    if(e.hotel) desc.push(t('nightIn',{st:e.hotel}));
    if(e.extra) desc.push(e.extra.join(', '));
    if(o.crew && e.crew) e.crew.forEach(l => desc.push(`${l.flight}: ` + l.members.filter(m=>m.name.trim()!==me.trim()).map(m=>m.role+' '+m.name).join(' · ')));
    const uid = `${(e.start||e.allDay).replace(/[^0-9TZ]/g,'')}-${icsEsc(title).replace(/[^A-Za-z0-9]/g,'').slice(0,20)}@payroster`;
    lines.push('BEGIN:VEVENT', 'UID:'+uid, 'DTSTAMP:'+now);
    if(e.allDay){ const dd = e.allDay.replace(/-/g,''); const nx = new Date(e.allDay+'T12:00:00Z'); nx.setUTCDate(nx.getUTCDate()+1);
      lines.push('DTSTART;VALUE=DATE:'+dd, 'DTEND;VALUE=DATE:'+nx.toISOString().slice(0,10).replace(/-/g,''), 'TRANSP:TRANSPARENT'); }
    else lines.push('DTSTART:'+e.start, 'DTEND:'+(e.end||addMin(e.start,60)));
    lines.push('SUMMARY:'+icsEsc(title));
    if(legs[0] || e.loc) lines.push('LOCATION:'+icsEsc(legs[0] ? legs[0].dep : e.loc));
    if(desc.length) lines.push('DESCRIPTION:'+icsEsc(desc.join('\n')));
    const stMs = e.start ? Date.parse(e.start.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z')) : 0;
    const before = e.pk ? Math.round((stMs - e.pk)/60000) : 0;
    if(o.alarm && !e.allDay) lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc((e.pk ? '🚐 ' : '') + title),'TRIGGER:-PT'+(o.alarm + before)+'M','END:VALARM');
    if(o.night && !e.allDay && stMs){ const bed = sleepPlan(stMs, e.pk).bed;
      lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc('😴 ' + t('sl_alarm', {w: localHM(sleepPlan(stMs, e.pk).wake, (legs[0] && legs[0].dep) || e.loc)})),'TRIGGER;VALUE=DATE-TIME:'+new Date(bed - 30*60e3).toISOString().replace(/[-:]/g,'').slice(0,15)+'Z','END:VALARM'); }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // fold lines at 75 octets-ish
  return { text: lines.map(l => l.length>74 ? l.match(/.{1,74}/g).join('\r\n ') : l).join('\r\n'), n: ev.length };
}
function renderCal(msg){
  pnl(hdr('cal', t('cal_intro')) + `<div class="form" style="margin-top:0">
    <label>${t('cal_range')}<select id="cal-r"><option value="cur">${t('cal_cur')}</option><option value="all">${t('cal_all')}</option></select></label>
    <label>${t('cal_alarm')}<select id="cal-a"><option value="0">${t('no')}</option><option value="60">1 h</option><option value="90" selected>1:30 h</option><option value="120">2 h</option><option value="180">3 h</option></select></label>
    <label class="chk"><input type="checkbox" id="cal-n" checked> ${t('cal_night')}</label>
    <label class="chk"><input type="checkbox" id="cal-c" checked> ${t('cal_crew')}</label>
    <label class="chk"><input type="checkbox" id="cal-o"> ${t('cal_off')}</label>
    <div class="wide"><button class="btn" id="cal-go" type="button">${t('cal_make')}</button></div></div><div id="cal-out">${msg||''}</div>`);
}
async function giveFile(name, text, mime){
  const file = new File([text], name, {type:mime});
  if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:name}); return 'shared'; }catch(e){ if(e && e.name==='AbortError') return 'cancel'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 2000); return 'download';
}
async function runCal(){
  const all = $('cal-r').value==='all';
  const months = all ? Object.keys(state.months).sort().map(k=>state.months[k]) : [state.months[state.current]].filter(Boolean);
  const o = { alarm: +$('cal-a').value, crew: $('cal-c').checked, off: $('cal-o').checked, night: $('cal-n').checked };
  const ics = buildIcs(months, o);
  const ro = state.months[state.current];
  const name = all ? 'payroster-roster.ics' : `payroster-${key(ro)}.ics`;
  const how = await giveFile(name, ics.text, 'text/calendar');
  $('cal-out').innerHTML = `<p class="msg">${t('cal_done',{n:ics.n})}</p>`;
}

// ================= 4. FTL limits =================
const blockMin = l => { const m = x => Math.floor(+x/100)*60 + (+x%100); let v = m(l.t2) - m(l.t1); if(v<0) v += 1440; return v; };
function ftlTimeline(){
  const map = {};
  for(const k of Object.keys(state.months)){
    const ro = state.months[k];
    for(const d of ro.days){
      const duty = d.dtLimit != null ? d.dtLimit : (d.dt || 0);
      const blk = (d.events||[]).filter(e=>e.type==='flt').reduce((a,l)=>a+blockMin(l),0)/60;
      map[d.date] = { duty, block: blk };
    }
  }
  return map;
}
function renderFtl(){
  const ro = state.months[state.current]; if(!ro){ pnl(hdr('ftl')+`<p class="msg">${t('startText')}</p>`); return; }
  const map = ftlTimeline(), s = state.settings;
  const sc = full => s.contract>=100 ? full : Math.min(full, Math.round(full * s.contract/100 * 1.1));
  const dayAdd = (iso, n) => { const d = new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
  const win = (end, n, f) => { let sum=0, missing=false; for(let i=0;i<n;i++){ const x = map[dayAdd(end,-i)]; if(!x) missing=true; else sum += x[f]; } return {sum, missing}; };
  const days = ro.days.map(d=>d.date), last = days[days.length-1];
  const peak = (n, f) => { let best={sum:0,end:days[0],missing:false}; for(const dd of days){ const w = win(dd,n,f); if(w.sum>best.sum) best={...w,end:dd}; } return best; };
  const yearSum = (f) => { let sum=0; for(const k in map){ if(k.startsWith(ro.year+'-') && k<=last) sum += map[k][f]; } return sum; };
  const items = [
    { lbl:t('ftl_d7'),  w:peak(7,'duty'),   lim:60 },
    { lbl:t('ftl_d14'), w:peak(14,'duty'),  lim:110 },
    { lbl:t('ftl_d28'), w:peak(28,'duty'),  lim:sc(190) },
    { lbl:t('ftl_b28'), w:peak(28,'block'), lim:sc(100) },
    { lbl:t('ftl_b12m'),w:win(last,365,'block'), lim:sc(1000) },
    { lbl:t('ftl_byear',{y:ro.year}), w:{sum:yearSum('block')}, lim:sc(900) },
    { lbl:t('ftl_dyear',{y:ro.year}), w:{sum:yearSum('duty')},  lim:sc(2000) },
  ];
  const anyMissing = items.some(i=>i.w.missing);
  pnl(hdr('ftl', t('ftl_intro',{m:nm(ro.year,ro.month)})) + `<div class="mg">${items.map(i=>{
    const p = i.w.sum/i.lim*100;
    return meterRow({t:i.lbl, v:t('mt_used', {p:Math.round(p)}), p, tone:meterTone(p),
      s:`${fmtH(i.w.sum)} / ${i.lim} h${i.w.end?` · ${t('ftl_until',{d:+i.w.end.slice(8)})}`:''}`}); }).join('')}</div>
    ${typeof ftlNowHtml === 'function' ? ftlNowHtml() : ''}
    ${anyMissing?`<p class="note">${t('ftl_missing')}</p>`:''}<p class="note">${t('ftl_note')}${s.contract<100?' '+t('ftl_pt',{c:s.contract}):''}</p>`);
}

// ================= 5. holidays & days off =================
function vacEntitlement(year){
  const j = state.settings.joined; if(!j) return { days:30, known:false };
  const yrs = year - +j.slice(0,4) - ((+j.slice(5,7)>1 || +j.slice(8,10)>1) ? 1 : 0);
  return { days: yrs>=25 ? 42 : yrs>=5 ? 35 : 30, known:true, yrs };
}
function renderVac(){
  const ro = state.months[state.current]; const year = ro ? ro.year : new Date().getFullYear();
  const absence = new Set(String(state.settings.absenceCodes||'').split(/[,\s]+/).filter(Boolean).map(x=>x.toUpperCase()));
  const cats = ['vac','su','om','off','bez','sick'];
  const rows = [], vacDays = [], sickDays = [];
  for(let m=1;m<=12;m++){
    const r = state.months[kOf(year,m)]; if(!r) continue;
    const cnt = {vac:0,su:0,om:0,off:0,bez:0,sick:0};
    for(const d of r.days){
      const codes = d.events.filter(e=>e.type==='code').map(e=>e.code.toUpperCase());
      if(codes.includes('U') || codes.some(c=>/^U_/.test(c) && c!=='U_OFF')){ cnt.vac++; vacDays.push(d.date); }
      else if(codes.includes('SU')) cnt.su++;
      else if(codes.some(c=>/^KCC|KRANK|SICK|^K_|^AU$/.test(c))){ cnt.sick++; sickDays.push(d.date); }
      else if(codes.includes('O_M')) cnt.om++;
      else if(codes.some(c=>/^(O_|FREI|U_OFF|OFF$)/.test(c)) && !d.events.some(e=>e.type==='flt'||e.type==='ci')) cnt.off++;
      if(codes.some(c=>/^OFF_BEZ/.test(c))) cnt.bez++;
    }
    rows.push({m, cnt});
  }
  const tot = cats.reduce((o,k)=>(o[k]=rows.reduce((a,r)=>a+r.cnt[k],0),o),{});
  const ent = vacEntitlement(year);
  const carry = +((state.settings.vacCarry||{})[year]) || 0, have = ent.days + carry, over = tot.vac - have;
  // leave periods (consecutive days), so the count can be checked against the roster
  const per = [];
  for(const dt of vacDays){ const last = per[per.length-1];
    if(last && (Date.parse(dt) - Date.parse(last.b)) === 864e5) last.b = dt; else per.push({a:dt, b:dt}); }
  const dshort = iso => new Date(iso+'T12:00').toLocaleDateString(LOC,{day:'numeric',month:'short'});
  const perOf = days => { const out = []; for(const dt of days){ const l = out[out.length-1]; if(l && Date.parse(dt) - Date.parse(l.b) === 864e5) l.b = dt; else out.push({a:dt, b:dt}); } return out; };
  const sickTxt = perOf(sickDays).map(p => { const n = Math.round((Date.parse(p.b)-Date.parse(p.a))/864e5)+1;
    return `<span class="chip c-sick">${p.a===p.b ? dshort(p.a) : dshort(p.a)+' – '+dshort(p.b)} <b>${n}</b></span>`; }).join('');
  const perTxt = per.map(p=>{ const n = Math.round((Date.parse(p.b)-Date.parse(p.a))/864e5)+1;
    return `<span class="chip c-vac">${p.a===p.b ? dshort(p.a) : dshort(p.a)+' – '+dshort(p.b)} <b>${n}</b></span>`; }).join('');
  pnl(hdr('vac', t('vac_intro',{y:year})) +
    `<div class="mg" style="margin-bottom:12px">${meterRow({t:t('mt_vac'), v:t('mt_of', {a:tot.vac, b:have}), p:have ? tot.vac/have*100 : 0, tone:over>0?'over':'ok',
      s:t('vac_sum',{u:tot.vac,e:have,l:Math.max(0,have-tot.vac)})+(over>0?' '+t('vac_over',{x:over,e:have}):'')+(ent.known?'':' '+t('vac_noJoined'))})}</div>
    <label class="note salesm" style="margin:0 0 10px"><span>${t('vac_carry',{y:year-1,e:ent.days})}</span><input type="text" inputmode="numeric" id="vac-carry" data-y="${year}" value="${carry||''}" placeholder="0"></label>
    ${per.length ? `<div class="mrow"><div class="mh">${t('vac_periods')}</div><div class="chips">${perTxt}</div></div>` : ''}
    ${sickDays.length ? `<div class="mrow"><div class="mh">${t('vac_sickT', {n: sickDays.length})}</div><div class="chips">${sickTxt}</div><p class="note" style="margin:6px 0 0">${t('vac_sickNote')}</p></div>` : ''}
    <div class="mlist">${rows.map(r=>`<div class="mrow"><div class="mh">${nm(year,r.m,{month:'long'})}</div><div class="chips">${cats.filter(k=>r.cnt[k]).map(k=>`<span class="chip c-${k}">${t('vac_'+k)} <b>${r.cnt[k]}</b></span>`).join('') || '<span class="note">—</span>'}</div></div>`).join('')}
      <div class="mrow tot"><div class="mh">${t('vac_total')}</div><div class="chips">${cats.filter(k=>tot[k]).map(k=>`<span class="chip c-${k}">${t('vac_'+k)} <b>${tot[k]}</b></span>`).join('')}</div></div></div>
    <p class="note">${t('vac_note')}</p>`);
}

// ================= 6. year summary =================
function yearData(year){
  const s = state.settings, out = [];
  for(let m=1;m<=12;m++){
    const k = kOf(year,m), real = (state.slips||{})[k];
    if(real && real.lines){
      const R = slipBuckets(real.lines);
      const gross = real.totals && real.totals.devengos != null ? real.totals.devengos : null;
      out.push({ m, real:true, gross: gross!=null ? gross : null, dietas:R.dietas, ss:R.ss, irpf:R.irpf + R.ingCta, net:real.net });
      continue;
    }
    const [py,pm] = prevYM(year,m), prev = state.months[kOf(py,pm)];
    if(!prev && !state.months[k]) continue;
    const c = prev ? PR.compute(prev, s, state.extras) : null, P = slipFor(c, s, year, m);
    out.push({ m, real:false, partial:!prev, gross:P.gross, dietas:P.dietas, ss:P.ss, irpf:P.irpf + P.ingresoCta, net:P.net });
  }
  return out;
}
function renderYear(){
  const years = [...new Set([...Object.keys(state.months), ...Object.keys(state.slips||{})].map(k=>+k.slice(0,4)))].sort();
  const ro = state.months[state.current];
  const year = +($('yr-y') && $('yr-y').value) || (ro ? ro.year : years[years.length-1]);
  if(!year){ pnl(hdr('year')+`<p class="msg">${t('startText')}</p>`); return; }
  const rows = yearData(year);
  const full = rows.filter(r=>!r.partial), nPart = rows.length - full.length;
  const sum = f => full.reduce((a,r)=>a+(+r[f]||0),0);
  const max = Math.max(1, ...rows.map(r=>r.net));
  const W = 600, H = 170, bw = W/12;
  const bars = rows.map(r=>{ const h = r.net/max*(H-34); const x = (r.m-1)*bw;
    return `<rect x="${x+6}" y="${H-18-h}" width="${bw-12}" height="${h}" rx="3" fill="${r.real?'var(--pay)':'var(--accent)'}" opacity="${r.partial?0.45:1}"></rect>
      <text x="${x+bw/2}" y="${H-18-h-4}" text-anchor="middle" font-size="10" fill="var(--muted)">${Math.round(r.net)}</text>`; }).join('');
  const labels = [...Array(12)].map((_,i)=>`<text x="${i*bw+bw/2}" y="${H-4}" text-anchor="middle" font-size="10" fill="var(--muted)">${new Date(2024,i,1).toLocaleDateString(LOC,{month:'short'}).replace('.','')}</text>`).join('');
  pnl(hdr('year', t('yr_intro')) + `<label class="note">${t('yr_year')} <select id="yr-y">${years.map(y=>`<option${y===year?' selected':''}>${y}</option>`).join('')}</select></label>
    <div class="tablewrap" style="margin-top:10px"><svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" role="img" aria-label="${t('yr_chart')}">${bars}${labels}</svg></div>
    <div class="legend"><span><i style="background:var(--pay)"></i>${t('yr_real')}</span><span><i style="background:var(--accent)"></i>${t('yr_est')}</span></div>
    <div class="mlist">${rows.map(r=>`<div class="mrow"${r.partial?' style="opacity:.55"':''}><div class="mh"><span>${nm(year,r.m,{month:'long'})} <span class="note">${r.real?t('yr_realS'):r.partial?t('yr_partial'):t('yr_estS')}</span></span><b class="num">${eur.format(r.net)}</b></div>
      <div class="note num">${t('grossTotal')} ${r.gross!=null?eur.format(r.gross):'—'} · ${t('yr_diet')} ${eur.format(r.dietas)} · ${t('slip_ss')} ${eur.format(r.ss)} · IRPF ${eur.format(r.irpf)}</div></div>`).join('')}
      <div class="mrow tot"><div class="mh"><span>${t('vac_total')}</span><b class="num">${eur.format(sum('net'))}</b></div>
      <div class="note num">${t('grossTotal')} ${eur.format(sum('gross'))} · ${t('yr_diet')} ${eur.format(sum('dietas'))} · ${t('slip_ss')} ${eur.format(sum('ss'))} · IRPF ${eur.format(sum('irpf'))}</div></div></div>
    ${nPart?`<p class="note">${t('yr_partNote',{n:nPart})}</p>`:''}<p class="note">${t('yr_note',{g:eur.format(sum('gross')-sum('dietas')),i:eur.format(sum('irpf')),s:eur.format(sum('ss')),d:eur.format(sum('dietas'))})}</p>
    ${typeof irpfHtml === 'function' ? irpfHtml(year, rows) : ''}`);
}

// ================= 7. backup =================
function renderBackup(msg){
  const n = Object.keys(state.months).length, ns = Object.keys(state.slips||{}).length;
  pnl(hdr('backup', t('bk_intro')) + `<p class="note">${t('bk_have',{m:n,s:ns})}</p>
    <div class="row"><button class="btn" id="bk-exp" type="button">${t('bk_export')}</button>
    <label class="btn ghost" for="bk-in" style="display:inline-block">${t('bk_import')}</label><input type="file" id="bk-in" class="sr"></div>
    <div id="bk-out">${msg||''}</div>
    <h3 class="wh">📱 ${t('cfg_t')}</h3><p class="note">${t('cfg_intro')}</p>
    <div class="row"><button class="btn ghost" id="cfg-make" type="button">${t('cfg_make')}</button></div><div id="cfg-out"></div>`);
}
let bkPending = null;
// any file can be picked (iOS greys out .json files when the picker filters by type); the content is checked here
async function readBackup(f, outId){
  const out = $(outId); if(!out) return;
  try{ const j = JSON.parse(await f.text()); if(j.app!=='payroster' || !j.state || !j.state.months) throw 0;
    bkPending = j.state;
    out.innerHTML = `<p class="msg err">${t('bk_confirm',{m:Object.keys(j.state.months).length,d:esc(j.exported||'')})}</p><div class="row"><button class="btn danger" id="bk-ok" type="button">${t('bk_replace')}</button><button class="btn ghost" id="bk-no" type="button">${t('no')}</button></div>`;
  }catch(err){ out.innerHTML = `<p class="msg err">${t('bk_bad')}</p>`; }
}
document.addEventListener('change', async e=>{
  if(e.target.id==='bk-in' || e.target.id==='bk-in0'){
    const f = e.target.files[0]; if(!f) return;
    await readBackup(f, e.target.id==='bk-in' ? 'bk-out' : 'bk-out0');
    e.target.value = ''; return;
  }
  if(e.target.id==='sim-date'){ simDate = e.target.value; renderSim(); return; }
  if(e.target.id==='chk-k'){ renderCheck(e.target.value); return; }
  if(e.target.id==='yr-y'){ renderYear(); return; }
  if(e.target.id==='vac-carry'){ const y = e.target.dataset.y, v = parseInt(e.target.value,10);
    state.settings.vacCarry = state.settings.vacCarry || {}; if(v>0) state.settings.vacCarry[y] = v; else delete state.settings.vacCarry[y]; save(); renderVac(); return; }
});
document.addEventListener('click', async e=>{
  const tb = e.target.closest('[data-tool]'); if(tb){ openTool(tb.dataset.tool); return; }
  if(e.target.closest('#toolBack')){ if(history.state && history.state.tool) history.back(); else closeTool(); return; }
  const tg = e.target.closest('[data-tabgo]'); if(tg){ if(tg.dataset.tabgo === 'tools' && toolOpen && document.body.dataset.tab === 'tools'){ if(history.state && history.state.tool) history.back(); else closeTool(); return; } setTab(tg.dataset.tabgo); window.scrollTo(0,0); return; }
  const sd = e.target.closest('[data-sim]'); if(sd){ simDate = sd.dataset.sim; toolOpen = null; openTool('sim'); return; }
  const id = e.target.id;
  if(id==='sim-go'){ runSim(); return; }
  if(id==='mail-go'){
    const {subject, body} = buildMail(e.target.dataset.k, $('mail-l').value);
    $('mail-out').innerHTML = `<label class="note">${t('mail_subj')}<input type="text" id="mail-s" value="${esc(subject)}"></label>
      <textarea id="mail-b" rows="14">${esc(body)}</textarea>
      <div class="row"><button class="btn" id="mail-copy" type="button">${t('mail_copy')}</button>
      <button class="btn ghost" id="mail-open" type="button">${t('mail_open')}</button></div>
      <p class="note">${t('mail_note')}</p>`;
    return;
  }
  if(id==='mail-open'){ location.href = 'mailto:?subject=' + encodeURIComponent($('mail-s').value) + '&body=' + encodeURIComponent($('mail-b').value); return; }
  if(id==='mail-copy'){
    const txt = $('mail-s').value + '\n\n' + $('mail-b').value;
    try{ await navigator.clipboard.writeText(txt); e.target.textContent = '✓ ' + t('mail_copied'); }
    catch(err){ $('mail-b').select(); }
    return;
  }
  if(id==='cal-go'){ e.target.disabled = true; try{ await runCal(); } finally { e.target.disabled = false; } return; }
  if(id==='bk-exp'){
    const {stale, ...keep} = state;
    const data = JSON.stringify({ app:'payroster', v:1, exported: todayISO(), state: keep });
    const how = await giveFile(`payroster-copia-${todayISO()}.json`, data, 'application/json');
    if(how !== 'cancel'){ state.lastBackup = todayISO(); save(); if(typeof renderBkRemind === 'function') renderBkRemind(); }
    $('bk-out').innerHTML = `<p class="msg">${t('bk_done')}</p>`; return; }
  if(id==='bk-ok' && bkPending){ const lang = state.lang; state = Object.assign({ extras:{}, slips:{}, shared:{} }, bkPending); state.lang = state.lang || lang; bkPending = null;
    save(); location.reload(); return; }
  if(id==='bk-no'){ bkPending = null; ['bk-out','bk-out0'].forEach(x => $(x) && ($(x).innerHTML='')); return; }
});
