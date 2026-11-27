"""Reuse the immutable capture app, without resigning it or weakening startup checks."""
from pathlib import Path
import glob,json,os,re,subprocess,urllib.request
root=Path(__file__).resolve().parents[2]
run=os.environ['CAPTURE_REUSE_RUN'];assert re.fullmatch(r'\d+',run)
request=urllib.request.Request(f'https://api.github.com/repos/krabople/Bellywise-iOS/actions/runs/{run}',headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json'})
with urllib.request.urlopen(request,timeout=30) as response:record=json.load(response)
assert record['event']=='workflow_dispatch' and record['head_branch']=='codex/localised-screen-captures', 'Not an isolated capture build'
assert re.fullmatch('[a-f0-9]{40}',record['head_sha'])
candidates=[]
for app in glob.glob('/Applications/Xcode*.app'):
 if 'beta' in app.lower():continue
 developer=str(Path(app,'Contents/Developer').resolve())
 try:
  output=subprocess.check_output(['xcodebuild','-version'],env={**os.environ,'DEVELOPER_DIR':developer},text=True,stderr=subprocess.STDOUT,timeout=20)
  match=re.search(r'^Xcode\s+(\d+(?:\.\d+)*)',output,re.M)
  if match:
   version=tuple(map(int,match[1].split('.')))
   if version>=(26,4):candidates.append((version,developer))
 except (OSError,subprocess.SubprocessError):pass
assert candidates,'No supported stable Xcode found'
developer=max(candidates)[1];environment={**os.environ,'DEVELOPER_DIR':developer}
out=root/'artifacts/reused-app';out.mkdir(parents=True,exist_ok=True)
subprocess.run(['ditto','-x','-k',str(root/'artifacts/reused-source/Bellywise-simulator.zip'),str(out)],check=True)
app=next(out.glob('*.app'))
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
subprocess.run(['python3',str(root/'scripts/ci/verify-localizations.py'),str(app),str(root/'foodprint/app.json')],check=True)
subprocess.run(['xcrun','--sdk','macosx','swiftc','-swift-version','5',str(root/'scripts/ci/read-simulator-screen.swift'),'-o',str(root/'artifacts/read-simulator-screen')],env=environment,check=True)
subprocess.run(['python3',str(root/'foodprint/tests/test_simulator_session.py')],check=True)
with open(os.environ['GITHUB_ENV'],'a') as stream:
 stream.write(f'DEVELOPER_DIR={developer}\nCAPTURE_PREBUILT_APP={app}\nCAPTURE_SOURCE_SHA={record["head_sha"]}\n')
print('Reusing exact signed simulator app from '+record['head_sha']+'. Actual startup UI verification remains required.')
