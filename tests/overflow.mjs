import fs from 'fs'; import { createRequire } from 'module';
const require=createRequire(import.meta.url); const {chromium}=require('playwright');
const b=await chromium.launch(); 
for(const L of ['es','hu','de']){
const pg=await (await b.newContext({viewport:{width:375,height:800}})).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript(l=>{ const s=JSON.parse(localStorage.getItem('payroster.v1')||'null'); }, L);
await pg.goto('file://'+process.cwd()+'/payroster.html'); await pg.waitForTimeout(400);
await pg.evaluate(l=>{ state.lang=l; setLang(l); render(); HTMLElement.prototype.scrollIntoView=()=>{}; }, L);
const res=[];
const chk=async lbl=>{ const o=await pg.evaluate(()=>{ const w=document.documentElement.clientWidth; const bad=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.right>w+1 && !e.closest('.tablewrap,.strip,.mapbox,svg');}).slice(0,3).map(e=>e.tagName+'.'+e.className+':'+(e.innerText||'').slice(0,30)); return {sw:document.documentElement.scrollWidth,w,bad}; }); if(o.sw>o.w||o.bad.length) res.push(lbl+' '+JSON.stringify(o)); };
await chk('roster');
for(const k of await pg.evaluate(()=>TOOLS)){ await pg.evaluate(k=>{toolOpen=null; openTool(k);}, k); await pg.waitForTimeout(150); await chk('tool '+k); }
await pg.evaluate(()=>setTab('more')); await chk('more');
console.log(L, res.length?res.join('\n'):'no overflow', errs);
}
await b.close();
