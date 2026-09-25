import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyTesterInvitationError } from '../scripts/ci/release-testflight-beta.mjs';

test('accepts Apple invitation conflicts that mean access already exists', () => {
  assert.equal(
    classifyTesterInvitationError(new Error('Apple API returned 409 (STATE_ERROR.TESTER_INVITE.ALREADY_ACCEPTED).')),
    'already-accepted',
  );
});

test('keeps the first-review deferral separate from an accepted invitation', () => {
  assert.equal(
    classifyTesterInvitationError(new Error('STATE_ERROR.TESTER_INVITE.NO_INSTALLABLE_BUILDS')),
    'deferred',
  );
  assert.equal(classifyTesterInvitationError(new Error('A different Apple error')), null);
});
