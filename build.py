import json, datetime
VER=datetime.datetime.now().strftime('%Y.%m.%d-%H%M')
t=open('app.template.html').read().replace('/*I18N*/',open('i18n.js').read()).replace('/*QR*/',open('qrlib/node_modules/qrcode-generator/qrcode.js').read()).replace('/*FFLATE*/',open('fflib/node_modules/fflate/umd/index.js').read()).replace('/*TOOLS*/',open('tools.js').read()+'\n'+open('features.js').read()+'\n'+open('mapview.js').read()+'\n'+open('features2.js').read()+'\n'+open('globe3d.js').read()+'\n'+open('features3.js').read()).replace('/*AIRPORTS*/',open('airports.js').read()+'\n'+open('mapdata.js').read()); eng=open('engine.js').read()
mine={"rank":"PU","levelMode":"date","since":"2022-04-01","isTrainer":True,"joined":"2018-01-22","irpf":19.87,"contract":100,"configured":True}
# artifact: Attila's own copy, with November preloaded
a=t.replace('/*ENGINE*/',eng).replace('/*DATA*/',open('roster.json').read()).replace('/*SETTINGS*/',json.dumps(mine)).replace('/*VERSION*/',VER).replace('/*PWA*/','false')
a=a.replace('/*SWREG*/','')
open('payroster.html','w').write(a)
# published Claude copy: no personal data at all
pub=t.replace('/*ENGINE*/',eng).replace('/*DATA*/','null').replace('/*SETTINGS*/','null').replace('/*VERSION*/',VER).replace('/*PWA*/','false').replace('/*SWREG*/','')
open('payroster_pub.html','w').write(pub)
# public webapp: no personal data, profile asked on first launch
p=t.replace('/*ENGINE*/',eng).replace('/*DATA*/','null').replace('/*SETTINGS*/','null').replace('/*VERSION*/',VER).replace('/*PWA*/','true')
p=p.replace("const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';","const PDFJS = './lib/';")
p=p.replace("await loadScript(PDFJS+'pdf.min.js'); await loadScript(PDFJS+'pdf.worker.min.js');","await loadScript(PDFJS+'pdf.min.js');")
p=p.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
head=open('pwa_head.html').read()
i=p.index('<div class="wrap">')
p=head+p[:i]+'</head>\n<body data-pv="list">\n'+p[i:]
assert '/*SWREG*/' in p
p=p.replace('/*SWREG*/',"if('serviceWorker' in navigator){ addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }")
p+='\n</body>\n</html>\n'
open('pwa/index.html','w').write(p)

open('pwa/version.json','w').write(json.dumps({'version':VER}))
open('pwa/sw.js','w').write(open('sw.template.js').read().replace('/*VERSION*/',VER))
print('version',VER)
