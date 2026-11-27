"""Capture actual localised iOS UI from the separate capture entry point."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,os,re,struct,subprocess,time
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--locales');parser.add_argument('--exclude');parser.add_argument('--keep-devices',action='store_true');args=parser.parse_args()
if os.environ.get('GITHUB_ACTIONS')!='true':raise SystemExit('Native capture is restricted to disposable GitHub CI simulators.')
spec=importlib.util.spec_from_file_location('simulator_session',Path(__file__).with_name('simulator-session.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
original_select=module.select_device
def select(data,sdk,family='iPhone'):
 runtime,device=original_select(data,sdk,family)
 preferred='iPhone 16 Pro Max' if family=='iPhone' else 'iPad Air 13-inch (M3)'
 installed=next((d for d in data['devicetypes'] if d['name']==preferred),None)
 if installed:device=installed['identifier']
 return runtime,device
module.select_device=select
app=next((root/'artifacts/ios-derived-data/Build/Products/Release-iphonesimulator').glob('*.app'))
bundle=json.loads(subprocess.check_output(['plutil','-convert','json','-o','-',str(app/'Info.plist')]))['CFBundleIdentifier']
sdk=subprocess.check_output(['xcrun','--sdk','iphonesimulator','--show-sdk-version'],text=True).strip()
locales=re.findall(r"\['([^']+)', '",(root/'foodprint/src/i18n/locales.ts').read_text().split('] as const')[0])
if args.locales:locales=[l for l in locales if l in args.locales.split(',')]
if args.exclude:locales=[l for l in locales if l not in args.exclude.split(',')]
out=root/'artifacts/localized-captures';out.mkdir(parents=True,exist_ok=True)
sessions={}
try:
 for device,family in [('iphone','iPhone'),('ipad','iPad')]:
  directory=root/'artifacts'/('capture-session-'+device);directory.mkdir(exist_ok=True)
  session=module.Session(directory,bundle);sessions[device]=session
  # Reuse only devices this same CI run created in the first capture phase.
  if not session.state['created']:session.start(str(app),sdk,family)
  identifier=session.state['device']
  subprocess.run(['xcrun','simctl','status_bar',identifier,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100'],check=True)
  subprocess.run(['xcrun','simctl','ui',identifier,'appearance','light'],check=True)
 for locale in locales:
  records=[]
  for device,session in sessions.items():
   scenes=['journal','ingredients','patterns','symptom','photo' if device=='iphone' else 'checkin','ingredient','repeat','checkin' if device=='iphone' else 'discover','notifications','privacy']
   for order,scene in enumerate(scenes,1):
    dest=out/locale/device;dest.mkdir(parents=True,exist_ok=True)
    url=f'bellywise://capture?locale={locale}&scene={scene}'
    subprocess.run(['xcrun','simctl','openurl',session.state['device'],url],check=True,timeout=30)
    time.sleep(4)
    file=dest/f'{order:02d}-{scene}.png'
    subprocess.run(['xcrun','simctl','io',session.state['device'],'screenshot','--type=png',str(file)],check=True,timeout=30,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    raw=file.read_bytes();width,height=struct.unpack('>II',raw[16:24]);assert width>1000 and height>2000
    records.append({'device':device,'order':order,'scene':scene,'file':str(file.relative_to(out)),'width':width,'height':height,'sha256':hashlib.sha256(raw).hexdigest()})
  (out/locale/'capture-manifest.json').write_text(json.dumps({'locale':locale,'source':os.environ.get('GITHUB_SHA'),'renderer':'actual iOS Simulator capture entry point, shared production components','screenshots':records},indent=2))
  print(f'Captured {locale}: {len(records)} actual iOS screenshots.',flush=True)
finally:
 if not args.keep_devices:
  for session in sessions.values():session.cleanup()
