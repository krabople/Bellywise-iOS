import test from 'node:test';
import assert from 'node:assert/strict';
import { readBuildSnapshot, verifyProcessedBuild } from '../scripts/ci/verify-testflight.mjs';

const target = { appId: '123', buildNumber: '8', marketingVersion: '1.0.0' };
function response(state = 'VALID', { version = '1.0.0', platform = 'IOS', app = '123', expired = false } = {}) {
  return {
    data: [{
      id: 'build1',
      attributes: { version: '8', processingState: state, expired },
      relationships: {
        app: { data: { id: app } },
        preReleaseVersion: { data: { id: 'version1' } },
        buildBetaDetail: { data: { id: 'beta1' } },
      },
    }],
    included: [{ id: 'version1', type: 'preReleaseVersions', attributes: { version, platform } }, { id: 'beta1', type: 'buildBetaDetails', attributes: { internalBuildState: 'READY_FOR_BETA_TESTING', externalBuildState: 'READY_FOR_BETA_SUBMISSION' } }],
  };
}

test('Processing verification cannot accept a different app, marketing version or platform', () => {
  for (const mismatch of [{ app: '456' }, { version: '2.0.0' }, { platform: 'TV_OS' }]) {
    assert.equal(readBuildSnapshot(response('VALID', mismatch), target).processingVerified, false);
  }
  assert.equal(readBuildSnapshot(response(), target).processingVerified, true);
  assert.equal(readBuildSnapshot(response('VALID', { expired: true }), target).processingVerified, false);
});

test('Read-only verifier waits for processing and reports beta status separately', async () => {
  const states = ['PROCESSING', 'VALID'];
  const paths = [];
  const result = await verifyProcessedBuild({ ...target, api: { request: async (resource) => { paths.push(resource); return response(states.shift()); } }, sleep: async () => {} });
  assert.equal(result.processingVerified, true);
  assert.equal(result.internalBuildState, 'READY_FOR_BETA_TESTING');
  assert.equal(result.externalBuildState, 'READY_FOR_BETA_SUBMISSION');
  assert.equal(paths.length, 2);
  assert.ok(paths.every((resource) => resource.startsWith('/v1/builds?')));
});

test('Failed processing stops immediately and continued invisibility times out', async () => {
  await assert.rejects(() => verifyProcessedBuild({ ...target, api: { request: async () => response('INVALID') }, sleep: async () => { throw Error('should not sleep'); } }), /INVALID/);
  let now = 0;
  await assert.rejects(() => verifyProcessedBuild({ ...target, api: { request: async () => ({ data: [] }) }, now: () => now, sleep: async (duration) => { now += duration; }, timeoutMs: 20, pollMs: 10 }), /Timed out.*NOT_YET_VISIBLE/);
});
