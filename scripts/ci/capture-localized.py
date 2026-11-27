"""Capture actual localised iOS UI from the separate capture entry point."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,os,re,struct,subprocess,time
from capture_fixture_bridge import FixtureBridge
from capture_screen_policy import visible_capture
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--locales');parser.add_argument('--exclude');args=parser.parse_args()
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
app=Path(os.environ['CAPTURE_PREBUILT_APP']) if os.environ.get('CAPTURE_PREBUILT_APP') else next((root/'artifacts/ios-derived-data/Build/Products/Release-iphonesimulator').glob('*.app'))
bundle=json.loads(subprocess.check_output(['plutil','-convert','json','-o','-',str(app/'Info.plist')]))['CFBundleIdentifier']
sdk=subprocess.check_output(['xcrun','--sdk','iphonesimulator','--show-sdk-version'],text=True).strip()
locales=re.findall(r"\['([^']+)', '",(root/'foodprint/src/i18n/locales.ts').read_text().split('] as const')[0])
if args.locales:locales=[l for l in locales if l in args.locales.split(',')]
if args.exclude:locales=[l for l in locales if l not in args.exclude.split(',')]
out=root/'artifacts/localized-captures';out.mkdir(parents=True,exist_ok=True)
sessions={}
records={locale:[] for locale in locales}
bridge=FixtureBridge();bridge.start()
try:
 for device,family in [('iphone','iPhone'),('ipad','iPad')]:
  directory=root/'artifacts'/('capture-session-'+('fr' if args.locales=='fr' else 'remaining')+'-'+device);directory.mkdir(exist_ok=True)
  session=module.Session(directory,bundle);sessions[device]=session
  # Keep a single owned simulator running to avoid memory/Metal contention.
  if not session.state['created']:
   session.start(str(app),sdk,family)
   # Process existence alone never establishes a successful app startup.
   verified=False
   for attempt in range(6):
    screen=directory/'welcome.png';ocr=directory/'welcome-ocr.json'
    subprocess.run(['xcrun','simctl','io',session.state['device'],'screenshot','--type=png',str(screen)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    ocr.write_bytes(subprocess.check_output([str(root/'artifacts/read-simulator-screen'),str(screen)]))
    check=subprocess.run(['node',str(root/'scripts/ci/verify-native-screen.mjs'),str(ocr)])
    if check.returncode==0:verified=True;break
    if check.returncode!=3:raise RuntimeError('The actual native app displayed an error screen.')
    time.sleep(3)
   if not verified:raise RuntimeError('The actual native welcome screen was not confirmed.')
  identifier=session.state['device']
  subprocess.run(['xcrun','simctl','status_bar',identifier,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100'],check=True)
  subprocess.run(['xcrun','simctl','ui',identifier,'appearance','light'],check=True)
  for locale in locales:
   scenes=['journal','ingredients','patterns','symptom','photo' if device=='iphone' else 'checkin','ingredient','repeat','checkin' if device=='iphone' else 'discover','notifications','privacy']
   for order,scene in enumerate(scenes,1):
    dest=out/locale/device;dest.mkdir(parents=True,exist_ok=True)
    for presentation_attempt in (1,2):
     fixture=bridge.select(device,locale,scene)
     deadline=time.time()+40
     while time.time()<deadline:
      confirmed=bridge.confirmed(device,fixture)
      if confirmed:break
      time.sleep(.2)
     if confirmed:break
     if presentation_attempt==2:raise RuntimeError(f'The actual app did not confirm {locale}/{device}/{scene}; no screenshot accepted.')
     print(f'Retrying native presentation: {locale}/{device}/{scene}',flush=True)
    # The app acknowledges a committed render; allow modal animation/image decode.
    time.sleep(1.2)
    file=dest/f'{order:02d}-{scene}.png'
    for screenshot_attempt in (1,2):
     pending=file.with_name(file.stem+f'-pending-{screenshot_attempt}.png')
     try:
      subprocess.run(['xcrun','simctl','io',session.state['device'],'screenshot','--type=png',str(pending)],check=True,timeout=120,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
      pending.replace(file)
      break
     except (subprocess.TimeoutExpired,subprocess.CalledProcessError):
      if screenshot_attempt==2:raise
      print(f'Retrying simulator screenshot transport: {locale}/{device}/{scene}',flush=True)
      time.sleep(2)
    # Never accept a loading spinner or a system sheet as an app screenshot.
    evidence=json.loads(subprocess.check_output([str(root/'artifacts/read-simulator-screen'),str(file),locale],timeout=90))
    (dest/f'{order:02d}-{scene}-ocr.json').write_text(json.dumps(evidence,ensure_ascii=False))
    if not visible_capture(evidence):
     raise RuntimeError(f'Visible app content was not verified for {locale}/{device}/{scene}; screenshot rejected.')
    raw=file.read_bytes();width,height=struct.unpack('>II',raw[16:24]);assert width>1000 and height>2000
    records[locale].append({'device':device,'order':order,'scene':scene,'file':str(file.relative_to(out)),'width':width,'height':height,'sha256':hashlib.sha256(raw).hexdigest()})
  session.cleanup()
  sessions.pop(device)
 for locale in locales:
  (out/locale/'capture-manifest.json').write_text(json.dumps({'locale':locale,'verification':'native-presentation-v1','source':os.environ.get('CAPTURE_SOURCE_SHA',os.environ.get('GITHUB_SHA')),'renderer':'actual iOS Simulator capture entry point, shared production components','screenshots':records[locale]},indent=2))
  print(f'Captured {locale}: {len(records[locale])} actual iOS screenshots.',flush=True)
finally:
 bridge.stop()
 for session in sessions.values():session.cleanup()
