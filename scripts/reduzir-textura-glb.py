# Reduz as texturas de arquivos .glb (para os modelos de web/modelos/ ficarem leves).
# Reamostra cada imagem embutida para no máximo 1024 px e regrava em JPEG; remonta o binário do GLB.
# A repintura dos personagens trabalha em 1024 px, então não há perda visível.
# Requer Python 3 e Pillow (pip install pillow).   Uso:  python3 scripts/reduzir-textura-glb.py web/modelos/*.glb
import json,struct,io,sys
from PIL import Image
def shrink(path,size=1024,q=96):
  f=open(path,'rb').read(); L=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+L])
  bl=struct.unpack('<I',f[20+L:24+L])[0]; B=f[28+L:28+L+bl]
  imgviews={im['bufferView']:i for i,im in enumerate(j.get('images',[])) if 'bufferView' in im}
  out=bytearray(); 
  for vi,bv in enumerate(j['bufferViews']):
    data=B[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    if vi in imgviews:
      im=Image.open(io.BytesIO(data)).convert('RGB')
      if im.width>size: im=im.resize((size,size),Image.LANCZOS)
      b=io.BytesIO(); im.save(b,'JPEG',quality=q); data=b.getvalue(); j['images'][imgviews[vi]]['mimeType']='image/jpeg'
    while len(out)%4: out+=b'\0'
    bv['byteOffset']=len(out); bv['byteLength']=len(data); out+=data
  while len(out)%4: out+=b'\0'
  j['buffers'][0]['byteLength']=len(out)
  js=json.dumps(j,separators=(',',':')).encode()
  while len(js)%4: js+=b' '
  tot=12+8+len(js)+8+len(out)
  open(path,'wb').write(struct.pack('<III',0x46546C67,2,tot)+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+bytes(out))
for p in sys.argv[1:]: shrink(p)
