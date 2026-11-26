"""Extract only authored captions and public page text for offline translations."""
import ast, json, html, re
from html.parser import HTMLParser
from pathlib import Path
root = Path(__file__).resolve().parents[2]
result = {}
messages = set()
for device, folder in [('iphone', 'App Store screenshots'), ('ipad', 'App Store iPad')]:
    tree = ast.parse((root/folder/'create_screenshots.py').read_text(encoding='utf-8'))
    items = []
    current = None
    for node in tree.body:
        call = node.value if isinstance(node, (ast.Assign, ast.Expr)) else None
        if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name): continue
        if call.func.id == 'canvas':
            args = [ast.literal_eval(value) for value in call.args[:4]]
            current = dict(zip(['theme','title','subtitle','eyebrow'],args)); current['labels']=[]; current['footers']=[]
            messages.update(args[1:])
        elif call.func.id == 'label' and current:
            text = ast.literal_eval(call.args[1]); current['labels'].append({'text':text,'xy':ast.literal_eval(call.args[2]),'size':next((ast.literal_eval(k.value) for k in call.keywords if k.arg=='size'),31)}); messages.add(text)
        elif call.func.id == 'footer' and current:
            text = ast.literal_eval(call.args[1]); current['footers'].append({'text':text,'y':next((ast.literal_eval(k.value) for k in call.keywords if k.arg=='y'),2628 if device=='ipad' else 2782)}); messages.add(text)
        elif call.func.id == 'save' and current:
            current['order']=ast.literal_eval(call.args[1]); current['slug']=ast.literal_eval(call.args[2]);items.append(current);current=None
    result[device] = sorted(items,key=lambda item:item['order'])
class PublicText(HTMLParser):
    def __init__(self): super().__init__(); self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ['script','style','svg']: self.skip+=1
    def handle_endtag(self,tag):
        if tag in ['script','style','svg']: self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        text = html.unescape(data).strip()
        if not self.skip and len(text)>1 and re.search('[a-zA-Z]',text) and not re.search(r'https?://|@|^bellywise$',text): messages.add(text)
for page in ['index.html','support.html','privacy.html']:
    PublicText().feed((root/'docs'/page).read_text(encoding='utf-8'))
messages.update(['Food & symptom diary','Track possible food triggers','Find ingredient patterns','Example diary shown. Patterns are clues, not diagnoses.','App shown in English.',
 'Spot possible food triggers. Scan barcodes to log ingredients quickly, record symptoms, reuse meals and explore patterns. Your diary stays on your device.'])
out=root/'foodprint'/'localization';out.mkdir(exist_ok=True)
(out/'marketing-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'marketing-messages.json').write_text(json.dumps(sorted(messages),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Collected {len(messages)} public marketing/page messages and {sum(map(len,result.values()))} screenshot captions.')
