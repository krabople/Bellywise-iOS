import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWelcomeScreen } from '../../scripts/ci/verify-native-screen.mjs';

const welcome = ['9:41', 'Welcome to Bellywise', 'Get curious about what makes you feel like you.', 'Start my journal', 'Explore with example entries'];

test('native smoke requires actual welcome title and primary entry button', () => {
  assert.equal(assessWelcomeScreen(welcome).passed, true);
  assert.equal(assessWelcomeScreen(['Bellywise']).passed, false);
  assert.equal(assessWelcomeScreen(['Welcome to Bellywise', 'Start my journal']).passed, true);
  assert.equal(assessWelcomeScreen(['Welcome to Bellywise']).passed, false);
  assert.equal(assessWelcomeScreen(['Start my journal']).passed, false);
  assert.equal(assessWelcomeScreen([]).passed, false);
});

test('the build-2 SecureStore error screen fails even though the app is alive', () => {
  const result = assessWelcomeScreen([
    'Bellywise', "Calling the 'getValueWithKeyAsync' function has failed",
    'Caused by: KeyChainException: A required entitlement is missing.',
    'Your saved data has not been replaced.', 'Try opening again',
  ]);
  assert.equal(result.passed, false);
  assert.ok(result.errors.includes('required entitlement'));
  assert.ok(result.errors.includes('try opening again'));
});

test('error text takes precedence over any expected welcome phrases', () => {
  const result = assessWelcomeScreen([...welcome, 'Your saved data has not been replaced.']);
  assert.equal(result.passed, false);
  assert.ok(result.errors.length > 0);
});

test('OCR wrapping, case and punctuation do not hide a complete welcome', () => {
  assert.equal(assessWelcomeScreen(['WELCOME TO BELLYWISE', 'Start my', 'journal', 'Explore with example', 'entries.']).passed, true);
});

test('malformed OCR output is rejected instead of treated as success', () => {
  assert.throws(() => assessWelcomeScreen(undefined), /recognized text/);
  assert.throws(() => assessWelcomeScreen(['Welcome to Bellywise', 42]), /recognized text/);
});
