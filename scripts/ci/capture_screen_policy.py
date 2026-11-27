"""Reject empty captures without mistaking an unsupported OCR script for a blank UI."""
def visible_capture(evidence):
 lines=evidence.get('lines',[])
 if evidence.get('contentInkFraction',0)<.005:return False
 if 'open in bellywise' in ' '.join(lines).lower():return False
 return len(lines)>=5 or evidence.get('languageSupported') is False or evidence.get('ocrSkipped') is True
