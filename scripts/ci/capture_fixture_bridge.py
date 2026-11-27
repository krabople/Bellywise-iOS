"""Loopback-only fictional visual-test scenes, with exact render acknowledgements."""
import json,threading,math
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs

class FixtureBridge:
 def __init__(self,port=8769):
  self._fixtures={};self._ready={};self._viewports={};self._sequence=0;self._lock=threading.Lock();owner=self
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_GET(self):
    request=urlparse(self.path);query=parse_qs(request.query);device=query.get('device',[''])[0]
    if device not in ('iphone','ipad'):self.send_error(400);return
    with owner._lock:
     if request.path=='/fixture':payload=owner._fixtures.get(device)
     elif request.path=='/ready':
      expected=owner._fixtures.get(device)
      accepted=bool(expected and all(query.get(key,[''])[0]==str(expected[key]) for key in ('sequence','locale','scene','presentation')))
      viewport=None
      if accepted and expected['scene']=='ingredients':
       try:
        viewport=json.loads(query.get('viewport',['null'])[0])
        accepted=isinstance(viewport,dict) and set(viewport)=={'left','top','width','height'} and all(type(v) in (int,float) and math.isfinite(v) and v>=0 for v in viewport.values()) and viewport['width']>0 and viewport['height']>0
       except (ValueError,TypeError):accepted=False
      if accepted and viewport:owner._viewports[device]={'sequence':expected['sequence'],'rect':viewport}
      if accepted:owner._ready[device]=expected.copy()
      payload={'accepted':accepted}
     else:self.send_error(404);return
    data=json.dumps(payload).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
  self.server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
  self.address='http://127.0.0.1:'+str(self.server.server_port)
 def start(self):threading.Thread(target=self.server.serve_forever,daemon=True).start()
 def stop(self):self.server.shutdown();self.server.server_close()
 def select(self,device,locale,scene):
  if device not in ('iphone','ipad'):raise ValueError('Unknown capture device')
  with self._lock:
   self._sequence+=1;value={'locale':locale,'scene':scene,'sequence':self._sequence,'presentation':'page' if scene in ('journal','discover') else 'modal'};self._fixtures[device]=value
   return value.copy()
 def confirmed(self,device,fixture):
  with self._lock:return self._ready.get(device)==fixture
 def viewport(self,device,fixture):
  with self._lock:
   value=self._viewports.get(device)
   return value['rect'].copy() if value and value['sequence']==fixture['sequence'] else None
