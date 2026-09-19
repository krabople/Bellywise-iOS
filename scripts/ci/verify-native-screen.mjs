import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const expected = ['welcome to bellywise', 'start my journal'];
const failures = [
  'try opening again', 'your saved data has not been replaced', 'keychainexception',
  'keychain exception', 'required entitlement', 'getvaluewithkeyasync',
  'your diary could not be opened', 'encrypted diary storage', 'database is locked',
  'file is not a database', 'unhandled js exception', 'invariant violation',
];

/** Require visible working UI; an alive process can still be a storage-error screen. */
export function assessWelcomeScreen(lines) {
  if (!Array.isArray(lines) || !lines.every(line => typeof line === 'string')) {
    throw new Error('Vision output must contain an array of recognized text lines.');
  }
  const text = normalize(lines.join(' '));
  const errors = failures.filter(phrase => text.includes(phrase));
  const missing = expected.filter(phrase => !text.includes(phrase));
  return { passed: errors.length === 0 && missing.length === 0, errors, missing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const result = assessWelcomeScreen(report.lines);
    if (result.errors.length) {
      console.error(`FAIL: Simulator screen shows a storage/startup error (${result.errors.join('; ')}).`);
      process.exitCode = 2;
    } else if (result.missing.length) {
      console.error(`NOT READY: Expected welcome screen text is missing (${result.missing.join('; ')}).`);
      process.exitCode = 3;
    } else {
      console.log('SCREEN VERIFIED: Screenshot OCR confirms Welcome to Bellywise and Start my journal; no storage/startup error text found.');
    }
  } catch (error) {
    console.error(`FAIL: Native screen evidence could not be verified: ${error.message}`);
    process.exitCode = 1;
  }
}
