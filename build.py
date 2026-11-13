#!/usr/bin/env python3
"""Build Payroster from src/ into dist/.
   dist/index.html (+ sw.js, version.json and the static files from pwa/) = the GitHub Pages PWA
   dist/payroster_pub.html = single-file copy without personal data (for a Claude artifact)
   dist/payroster_dev.html = single-file copy seeded from private/roster.json + private/settings.json if they exist (local tests only, never publish)"""
import json, datetime, os, shutil
R = os.path.dirname(os.path.abspath(__file__)); S = lambda f: open(os.path.join(R, 'src', f), encoding='utf8').read()
VER = datetime.datetime.now().strftime('%Y.%m.%d-%H%M')
t = (S('app.template.html').replace('/*I18N*/', S('i18n.js'))
     .replace('/*QR*/', open(os.path.join(R, 'vendor/qrcode.js')).read())
     .replace('/*FFLATE*/', open(os.path.join(R, 'vendor/fflate.umd.js')).read())
     .replace('/*TOOLS*/', '\n'.join(S(f) for f in ['tools.js', 'features.js', 'mapview.js', 'features2.js', 'globe3d.js', 'features3.js']))
     .replace('/*AIRPORTS*/', S('airports.js') + '\n' + S('mapdata.js')))
eng = S('engine.js')
out = os.path.join(R, 'dist'); os.makedirs(out, exist_ok=True)
priv = os.path.join(R, 'private')
if os.path.exists(os.path.join(priv, 'roster.json')):
    seed = open(os.path.join(priv, 'roster.json')).read()
    sett = open(os.path.join(priv, 'settings.json')).read() if os.path.exists(os.path.join(priv, 'settings.json')) else 'null'
    a = t.replace('/*ENGINE*/', eng).replace('/*DATA*/', seed).replace('/*SETTINGS*/', sett).replace('/*VERSION*/', VER).replace('/*PWA*/', 'false').replace('/*SWREG*/', '')
    open(os.path.join(out, 'payroster_dev.html'), 'w').write(a)
pub = t.replace('/*ENGINE*/', eng).replace('/*DATA*/', 'null').replace('/*SETTINGS*/', 'null').replace('/*VERSION*/', VER).replace('/*PWA*/', 'false').replace('/*SWREG*/', '')
open(os.path.join(out, 'payroster_pub.html'), 'w').write(pub)
p = t.replace('/*ENGINE*/', eng).replace('/*DATA*/', 'null').replace('/*SETTINGS*/', 'null').replace('/*VERSION*/', VER).replace('/*PWA*/', 'true')
p = p.replace("const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';", "const PDFJS = './lib/';")
p = p.replace("await loadScript(PDFJS+'pdf.min.js'); await loadScript(PDFJS+'pdf.worker.min.js');", "await loadScript(PDFJS+'pdf.min.js');")
p = p.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
i = p.index('<div class="wrap">')
p = S('pwa_head.html') + p[:i] + '</head>\n<body>\n' + p[i:]
assert '/*SWREG*/' in p, 'service worker placeholder missing'
p = p.replace('/*SWREG*/', "if('serviceWorker' in navigator){ addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }")
p += '\n</body>\n</html>\n'
open(os.path.join(out, 'index.html'), 'w').write(p)
open(os.path.join(out, 'version.json'), 'w').write(json.dumps({'version': VER}))
open(os.path.join(out, 'sw.js'), 'w').write(S('sw.template.js').replace('/*VERSION*/', VER))
for x in os.listdir(os.path.join(R, 'pwa')):
    s, d = os.path.join(R, 'pwa', x), os.path.join(out, x)
    (shutil.copytree(s, d, dirs_exist_ok=True) if os.path.isdir(s) else shutil.copy(s, d))
print('version', VER)
