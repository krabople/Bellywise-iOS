import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/ci'))
from capture_screen_policy import visible_capture
class CapturePolicyTests(unittest.TestCase):
 def test_unsupported_script_is_visible_even_without_ocr(self):
  self.assertTrue(visible_capture({'lines':['9:41'],'languageSupported':False,'contentInkFraction':.04}))
 def test_spinner_is_rejected_for_every_language(self):
  for supported in [True,False]:self.assertFalse(visible_capture({'lines':['9:41'],'languageSupported':supported,'contentInkFraction':.0003}))
 def test_supported_language_needs_readable_content(self):
  self.assertFalse(visible_capture({'lines':['9:41'],'languageSupported':True,'contentInkFraction':.04}))
  self.assertTrue(visible_capture({'lines':['9:41','Journal','Food','Symptoms','Patterns'],'languageSupported':True,'contentInkFraction':.04}))
 def test_open_dialog_is_never_accepted(self):
  self.assertFalse(visible_capture({'lines':['Open in Bellywise?'],'languageSupported':False,'contentInkFraction':.04}))
 def test_native_acknowledged_visual_capture_still_needs_visible_content(self):
  self.assertTrue(visible_capture({'lines':[],'ocrSkipped':True,'contentInkFraction':.04}))
  self.assertFalse(visible_capture({'lines':[],'ocrSkipped':True,'contentInkFraction':.00009}))
if __name__=='__main__':unittest.main()
