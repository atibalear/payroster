import json,re,sys
src=json.load(open(sys.argv[1]))
s=open('i18n.js').read()
for l,kv in src.items():
    m=re.search(r"\n  \"?"+l+r"\"?: \{\n", s); st=m.end(); en=s.index("\n  }",st); blk=s[st:en]
    quoted = blk.lstrip().startswith('"')
    for k,v in kv.items():
        v=v.replace("'","’")
        pat=re.compile((r'"'+k+r'": "[^"]*"') if quoted else (r"\b"+k+r": '[^']*'"))
        new=(f'"{k}": "{v}"' if quoted else f"{k}: '{v}'")
        if pat.search(blk): blk=pat.sub(lambda _:new,blk,count=1)
        else: blk="    "+new+",\n"+blk
    s=s[:st]+blk+s[en:]
open('i18n.js','w').write(s)
print('merged',list(src))
