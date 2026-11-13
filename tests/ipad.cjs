const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'pwa',decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.end(d);});}).listen(8773);
(async()=>{const b=await chromium.launch();
const p0=await b.newPage();await p0.goto('file://'+__dirname+'/payroster.html');await p0.waitForTimeout(500);const st=await p0.evaluate(()=>{save();return localStorage.getItem('payroster.v1')});
for(const [n,w,h] of [['land',1180,820],['port',820,1180]]){
 const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8773/index.html');await p.evaluate(s=>localStorage.setItem('payroster.v1',s),st);await p.reload();await p.waitForTimeout(1500);
 await p.screenshot({path:`tour/ipad_${n}_roster.png`});await p.evaluate(()=>window.scrollTo(0,330));await p.waitForTimeout(300);await p.screenshot({path:`tour/ipad_${n}_roster2.png`});
 await p.evaluate(()=>setTab('tools'));await p.waitForTimeout(400);await p.screenshot({path:`tour/ipad_${n}_tools.png`});
 await p.evaluate(()=>setTab('more'));await p.waitForTimeout(400);await p.screenshot({path:`tour/ipad_${n}_more.png`});
 const ow=await p.evaluate(()=>document.documentElement.scrollWidth);console.log(n,'scrollW',ow,errs);await c.close();}
await b.close();srv.close();})();
