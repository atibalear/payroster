const {JSDOM}=require('./jsd/node_modules/jsdom');const fs=require('fs');
for(const f of ['payroster.html','pwa/index.html']) for(const lang of ['es','ca','en','de','fr','it','pt','ro','hu','sk','cs']){
 const dom=new JSDOM(fs.readFileSync(f,'utf8'),{runScripts:'dangerously',url:'https://x.test/',beforeParse(w){w.localStorage.setItem('payroster.v1',JSON.stringify({lang,months:{},extras:{}}))}});
 const w=dom.window; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
 if(f.startsWith('pwa')) w.applyPayslip(w.PR.parsePayslip(require('./slip.json')));
 const b=w.document.body.cloneNode(true); b.querySelectorAll('script').forEach(s=>s.remove()); const txt=b.textContent.replace(/\s+/g,' ');
 const left=(txt.match(/\{\w+\}/g)||[]);
 const rawKeys=(txt.match(/\b(slip_|f_|su_|ps_|d_|k_|dc_)[a-zA-Z]+\b/g)||[]);
 console.log(f.padEnd(16),lang,'errs',errs.length?errs:'-','placeholders',left.length,'rawkeys',rawKeys.slice(0,3), '|', (w.document.querySelector('.eyebrow')||{}).textContent, '|', (w.document.getElementById('importMsg').textContent||'').slice(0,70));
 w.close();
}
