from pathlib import Path
from html.parser import HTMLParser
from html import escape, unescape
import json, re
root=Path(__file__).resolve().parents[2]
catalogs=json.loads((root/'foodprint/src/i18n/messages.json').read_text(encoding='utf-8'))
locales=re.findall(r"\['([^']+)', '",(root/'foodprint/src/i18n/locales.ts').read_text(encoding='utf-8').split('] as const')[0])
class LocalPage(HTMLParser):
    def __init__(self, locale): super().__init__(convert_charrefs=True);self.locale=locale;self.parts=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','svg'):self.skip+=1
        attrs=dict(attrs)
        if tag=='html':attrs.update(lang=self.locale,dir='rtl' if self.locale in ('ar','he','ur') else 'ltr')
        for key in ['href','src']:
            if attrs.get(key)=='styles.css':attrs[key]='../../styles.css'
            if attrs.get(key)=='data-sources.html':attrs[key]='../../data-sources.html'
        self.parts.append('<'+tag+''.join(' '+key+('="'+escape(value,quote=True)+'"' if value is not None else '') for key,value in attrs.items())+'>')
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
    def handle_endtag(self,tag):
        self.parts.append('</'+tag+'>')
        if tag in ('script','style','svg'):self.skip=max(0,self.skip-1)
    def handle_data(self,data):
        source=unescape(data).strip();translated=catalogs.get(self.locale,{}).get(source,source)
        if self.skip:self.parts.append(data);return
        # Keep the app brand and publisher's proper name unchanged.
        if source.endswith(' · Bellywise'):
            translated=translated.rsplit(' · ',1)[0]+' · Bellywise'
        if source=='Bellywise support':
            translated=catalogs.get(self.locale,{}).get('Support','Support')+' · Bellywise'
        if source=='Bellywise is provided by Benjamin David Berger.':
            translated=source
        start=re.match(r'^\s*',data)[0];end=re.search(r'\s*$',data)[0]
        self.parts.append(start+escape(translated)+end if source else data)
    def handle_entityref(self,name):self.parts.append('&'+name+';')
    def handle_charref(self,name):self.parts.append('&#'+name+';')
    def handle_decl(self,decl):self.parts.append('<!'+decl+'>')
    def handle_comment(self,data):self.parts.append('<!--'+data+'-->')
for locale in locales:
    if locale.startswith('en'):continue
    folder=root/'docs/languages'/locale;folder.mkdir(parents=True,exist_ok=True)
    for name in ['index.html','privacy.html','support.html']:
        parser=LocalPage(locale);parser.feed((root/'docs'/name).read_text(encoding='utf-8'))
        (folder/name).write_text(''.join(parser.parts),encoding='utf-8')
print(f'Prepared public support, privacy and information pages for {len([l for l in locales if not l.startswith("en")])} non-English locales.')
