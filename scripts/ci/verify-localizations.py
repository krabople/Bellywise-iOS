"""Verify localised native resources in the actual built app and widget."""
from pathlib import Path
import json, subprocess, sys

app=Path(sys.argv[1])
config=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))['expo']
locales=config['ios']['infoPlist'].get('CFBundleLocalizations',[])
def plist(file):
    return json.loads(subprocess.check_output(['plutil','-convert','json','-o','-',str(file)]))
assert len(locales)==50, 'Unexpected native language inventory'
assert set(locales)<=set(plist(app/'Info.plist').get('CFBundleLocalizations',[]))
widget=app/'PlugIns/BellywiseQuickLog.appex'
assert widget.is_dir(), 'Quick-log extension missing'
assert set(locales)<=set(plist(widget/'Info.plist').get('CFBundleLocalizations',[]))
for locale in locales:
    permissions=plist(app/f'{locale}.lproj/InfoPlist.strings')
    for key in ['NSCameraUsageDescription','NSPhotoLibraryUsageDescription']:
        assert permissions.get(key), f'{locale}: missing {key}'
    messages=plist(widget/f'{locale}.lproj/Localizable.strings')
    for key in ['Food or drink','Log a feeling','Review day']:
        assert messages.get(key), f'{locale}: missing widget shortcut {key}'
print(f'Verified {len(locales)} native permission and widget localisations in built bundles.')
