import importlib.util,json,unittest,urllib.request,urllib.parse
from pathlib import Path
spec=importlib.util.spec_from_file_location('bridge',Path(__file__).resolve().parents[2]/'scripts/ci/capture_fixture_bridge.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class BridgeTests(unittest.TestCase):
 def setUp(self):self.bridge=module.FixtureBridge(0);self.bridge.start()
 def tearDown(self):self.bridge.stop()
 def request(self,path,**query):
  with urllib.request.urlopen(self.bridge.address+path+'?'+urllib.parse.urlencode(query),timeout=3) as response:
   self.assertEqual(response.headers['Cache-Control'],'no-store');return json.load(response)
 def test_no_scene_before_welcome_verification(self):self.assertIsNone(self.request('/fixture',device='iphone'))
 def test_wrong_language_and_stale_render_cannot_unlock_capture(self):
  expected=self.bridge.select('iphone','fr','journal')
  self.assertFalse(self.request('/ready',device='iphone',**{**expected,'locale':'en-GB'})['accepted'])
  self.assertFalse(self.bridge.confirmed('iphone',expected))
  self.assertTrue(self.request('/ready',device='iphone',**expected)['accepted']);self.assertTrue(self.bridge.confirmed('iphone',expected))
  next_scene=self.bridge.select('iphone','fr','ingredients')
  self.assertFalse(self.request('/ready',device='iphone',**expected)['accepted']);self.assertFalse(self.bridge.confirmed('iphone',next_scene))
 def test_device_selections_are_independent(self):
  phone=self.bridge.select('iphone','fr','journal');tablet=self.bridge.select('ipad','ja','ingredient')
  self.assertEqual(self.request('/fixture',device='iphone'),phone);self.assertEqual(self.request('/fixture',device='ipad'),tablet)
 def test_background_page_cannot_confirm_a_required_modal(self):
  expected=self.bridge.select('iphone','fr','ingredients')
  self.assertEqual(expected['presentation'],'modal')
  self.assertFalse(self.request('/ready',device='iphone',**{**expected,'presentation':'page'})['accepted'])
  self.assertFalse(self.bridge.confirmed('iphone',expected))
  self.assertTrue(self.request('/ready',device='iphone',**expected)['accepted'])
if __name__=='__main__':unittest.main()
