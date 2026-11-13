const {chromium,devices}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],locale:'es-ES',acceptDownloads:true});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
const sep=JSON.parse(fs.readFileSync('sep.json')),nov=JSON.parse(fs.readFileSync('roster.json'));
const slip=(()=>{const PR=require('./engine.js');const x=PR.parsePayslip(require('./slip.json'));return {net:x.net,lines:x.lines,totals:x.totals};})();
await p.addInitScript(([s,n,sl])=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('payroster.v1',JSON.stringify({lang:'hu',months:{'2026-09':s,'2026-11':n},current:'2026-11',extras:{'2026-09':{sales:103.28}},slips:{'2026-10':sl},settings:{rank:'PU',levelMode:'date',since:'2022-04-01',isTrainer:true,irpf:19.87,ss:6.5,configured:true,v2slip:true,joined:'2018-01-22'}}))},[sep,nov,slip]);
await p.goto('file://'+process.cwd()+'/pwa/index.html');await p.waitForTimeout(300);
await p.evaluate(()=>setTab('tools'));
const txt=async()=> (await p.textContent('#toolPanel')).replace(/\s+/g,' ');
for(const k of ['check','ftl','vac','year','backup','cal']){ await p.click(`.tile[data-tool=${k}]`); await p.waitForTimeout(150); console.log('==',k,(await txt()).slice(0,420)); if(k==='check'||k==='year'||k==='ftl') await (await p.$('#toolPanel')).screenshot({path:`tool_${k}.png`}); await p.click("#toolBack"); await p.waitForTimeout(100); }
// calendar export
await p.click('.tile[data-tool=cal]'); const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#cal-go')]); const path=await dl.path(); const ics=fs.readFileSync(path,'utf8'); console.log('ics events',(ics.match(/BEGIN:VEVENT/g)||[]).length); console.log(ics.split('\r\n').slice(6,22).join('\n'));
// simulator from a day
await p.evaluate(()=>setTab('roster')); await p.click('#d-2026-11-09 > summary'); await p.click('[data-sim="2026-11-09"]'); await p.click('#sim-go'); console.log('== sim',(await txt()).slice(-260));
await (await p.$('#toolPanel')).screenshot({path:'tool_sim.png'});
// backup export
await p.click('#toolBack').catch(()=>{}); await p.click('.tile[data-tool=backup]'); const [d2]=await Promise.all([p.waitForEvent('download'),p.click('#bk-exp')]); const bj=JSON.parse(fs.readFileSync(await d2.path(),'utf8')); console.log('backup months',Object.keys(bj.state.months));
console.log('errors',errs);await b.close();})();
