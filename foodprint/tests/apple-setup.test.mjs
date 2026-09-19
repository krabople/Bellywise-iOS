import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createAppleClient, createToken, exportOptions, findMatchingProfile, normalizedFingerprint, selectDistributionCertificate } from '../scripts/ci/apple-setup.mjs';

const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const credentials = { issuerId: 'offline-test-issuer', keyId: 'TESTKEY123', privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const sha1 = 'A'.repeat(40);
const fakeCert = { fingerprint: sha1, subject: 'CN=Offline fixture\nOU=TEAM123456', validTo: '2030-01-01T00:00:00Z' };

test('Apple JWT uses verifiable P1363 ES256 and a bounded expiry', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  const token = createToken(credentials, now);
  const [header, payload, signature] = token.split('.');
  assert.equal(verify('sha256', Buffer.from(`${header}.${payload}`), { key: pair.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claims.aud, 'appstoreconnect-v1');
  assert.equal(claims.iss, credentials.issuerId);
  assert.equal(claims.exp - claims.iat, 600);
  assert.ok(claims.exp > now / 1000);
});

test('Apple client rejects a hostile pagination URL without transmitting credentials', async () => {
  const requests = [];
  const client = createAppleClient(credentials, async (url, options) => {
    requests.push({ url: String(url), options });
    return { ok: true, json: async () => ({ data: [], links: { next: 'https://outside.example/collect' } }) };
  });
  await assert.rejects(() => client.list('/v1/certificates'), /another origin/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, 'error');
});

test('Apple errors expose only status and error codes', async () => {
  const client = createAppleClient(credentials, async () => ({ ok: false, status: 403, json: async () => ({ errors: [{ code: 'FORBIDDEN', detail: 'PRIVATE_TEST_DETAIL' }] }) }));
  await assert.rejects(() => client.request('/v1/certificates'), (error) => error.message.includes('403 (FORBIDDEN)') && !error.message.includes('PRIVATE_TEST_DETAIL'));
});

test('Certificate selection rejects wrong team, expiry, duplicates and development certificates', () => {
  const records = [{ id: 'distribution-cert', attributes: { certificateType: 'DISTRIBUTION', certificateContent: 'fixture' } }];
  assert.equal(selectDistributionCertificate(records, sha1, 'TEAM123456', Date.parse('2026-01-01'), () => fakeCert).id, 'distribution-cert');
  assert.throws(() => selectDistributionCertificate(records, sha1, 'OTHER12345', Date.parse('2026-01-01'), () => fakeCert), /different Apple team/);
  assert.throws(() => selectDistributionCertificate(records, sha1, 'TEAM123456', Date.parse('2031-01-01'), () => fakeCert), /expired/);
  assert.throws(() => selectDistributionCertificate([...records, ...records], sha1, 'TEAM123456', Date.parse('2026-01-01'), () => fakeCert), /found 2/);
  assert.throws(() => selectDistributionCertificate([{ id: 'dev', attributes: { certificateType: 'DEVELOPMENT', certificateContent: 'fixture' } }], sha1, 'TEAM123456', Date.parse('2026-01-01'), () => fakeCert), /found 0/);
  assert.throws(() => normalizedFingerprint('not-a-fingerprint'), /40-character/);
});

test('Profiles must match bundle, certificate, active state and expiry', () => {
  const profile = { id: 'correct', attributes: { profileType: 'IOS_APP_STORE', profileState: 'ACTIVE', expirationDate: '2030-01-01' }, relationships: { bundleId: { data: { id: 'bundle' } }, certificates: { data: [{ id: 'cert' }] } } };
  const wrongCert = { ...profile, id: 'wrong-cert', relationships: { ...profile.relationships, certificates: { data: [{ id: 'another-cert' }] } } };
  assert.equal(findMatchingProfile([wrongCert, profile], 'bundle', 'cert', Date.parse('2026-01-01')).id, 'correct');
  assert.equal(findMatchingProfile([profile], 'another-bundle', 'cert', Date.parse('2026-01-01')), undefined);
  assert.equal(findMatchingProfile([profile], 'bundle', 'cert', Date.parse('2031-01-01')), undefined);
});

test('Export manifest binds one bundle to its profile and exact signing identity', () => {
  const output = exportOptions({ bundleId: 'com.example.diary', profileUuid: 'profile-uuid', teamId: 'TEAM123456', certificateSha1: sha1 });
  assert.ok(output.includes('<key>method</key><string>app-store-connect</string>'));
  assert.ok(output.includes(`<key>signingCertificate</key><string>${sha1}</string>`));
  assert.ok(output.includes('<key>com.example.diary</key><string>profile-uuid</string>'));
});
