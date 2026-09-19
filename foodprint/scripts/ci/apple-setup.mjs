#!/usr/bin/env node
// Apple public API 4.4.1. Dry run unless --apply is supplied. Never creates an App Store app record.
import { createPrivateKey, sign, X509Certificate } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const APPLE_ORIGIN = 'https://api.appstoreconnect.apple.com';

export function createToken({ issuerId, keyId, privateKey }, now = Date.now()) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const issued = Math.floor(now / 1000) - 15;
  const payload = Buffer.from(JSON.stringify({ iss: issuerId, iat: issued, exp: issued + 600, aud: 'appstoreconnect-v1' })).toString('base64url');
  const input = `${header}.${payload}`;
  const key = createPrivateKey(privateKey.replaceAll('\\n', '\n'));
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('APPSTORE_PRIVATE_KEY must be an ES256 App Store Connect key.');
  }
  return `${input}.${sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

export function createAppleClient(credentials, fetchImpl = fetch) {
  async function request(resource, method = 'GET', body) {
    const url = new URL(resource, APPLE_ORIGIN);
    if (url.origin !== APPLE_ORIGIN) throw new Error('Refusing to send Apple credentials to another origin.');
    const response = await fetchImpl(url, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${createToken(credentials)}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Only expose stable error codes, never echo API bodies, tokens or environment variables.
      const codes = (result.errors || []).map((error) => String(error.code || 'UNKNOWN').replace(/[^A-Z0-9_.-]/gi, '').slice(0, 80)).join(', ');
      throw new Error(`Apple API ${method} ${url.pathname} returned ${response.status}${codes ? ` (${codes})` : ''}.`);
    }
    return result;
  }
  async function list(resource) {
    const rows = [];
    const visited = new Set();
    let next = resource;
    while (next) {
      if (visited.has(next) || visited.size >= 100) throw new Error('Unexpected Apple API pagination.');
      visited.add(next);
      const page = await request(next);
      if (!Array.isArray(page.data)) throw new Error('Apple API did not return a resource list.');
      rows.push(...page.data);
      next = page.links?.next;
    }
    return rows;
  }
  return { request, list };
}

export function normalizedFingerprint(input) {
  const value = input.replaceAll(':', '').replaceAll(' ', '').toUpperCase();
  if (!/^[0-9A-F]{40}$/.test(value)) throw new Error('CERTIFICATE_SHA1 must be the exact 40-character SHA-1 of the imported distribution signing identity.');
  return value;
}

export function selectDistributionCertificate(records, fingerprint, teamId, now = Date.now(), decode = (content) => new X509Certificate(Buffer.from(content, 'base64'))) {
  const expected = normalizedFingerprint(fingerprint);
  const matches = [];
  for (const record of records) {
    if (!['DISTRIBUTION', 'IOS_DISTRIBUTION'].includes(record.attributes?.certificateType)) continue;
    if (!record.attributes?.certificateContent) continue;
    const certificate = decode(record.attributes.certificateContent);
    if (normalizedFingerprint(certificate.fingerprint) !== expected) continue;
    const subjectTeam = certificate.subject.split('\n').find((line) => line.startsWith('OU='))?.slice(3);
    if (subjectTeam !== teamId) throw new Error('The matching distribution certificate belongs to a different Apple team.');
    if (!(Date.parse(certificate.validTo) > now)) throw new Error('The imported distribution certificate has expired.');
    matches.push({ ...record, sha1: expected });
  }
  if (matches.length !== 1) throw new Error(`Expected exactly one active Apple distribution certificate matching the imported identity; found ${matches.length}.`);
  return matches[0];
}

export function findMatchingProfile(profiles, bundleResourceId, certificateId, now = Date.now()) {
  return profiles.filter((profile) =>
    profile.attributes?.profileType === 'IOS_APP_STORE'
    && profile.attributes?.profileState === 'ACTIVE'
    && Date.parse(profile.attributes?.expirationDate) > now
    && profile.relationships?.bundleId?.data?.id === bundleResourceId
    && profile.relationships?.certificates?.data?.some((certificate) => certificate.id === certificateId)
  ).sort((a, b) => Date.parse(b.attributes.expirationDate) - Date.parse(a.attributes.expirationDate))[0];
}

const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function exportOptions({ bundleId, profileUuid, teamId, certificateSha1 }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>export</string>
<key>teamID</key><string>${xml(teamId)}</string>
<key>signingStyle</key><string>manual</string>
<key>signingCertificate</key><string>${xml(certificateSha1)}</string>
<key>manageAppVersionAndBuildNumber</key><false/>
<key>uploadSymbols</key><true/>
<key>provisioningProfiles</key><dict><key>${xml(bundleId)}</key><string>${xml(profileUuid)}</string></dict>
</dict></plist>\n`;
}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

export async function prepareAppleSigning({ env = process.env, apply = false, outputDir = '.build/apple-signing', client } = {}) {
  const bundleId = required(env, 'APP_BUNDLE_ID');
  const teamId = required(env, 'TEAM_ID');
  const certificateSha1 = normalizedFingerprint(required(env, 'CERTIFICATE_SHA1'));
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9][A-Za-z0-9-]*)+$/.test(bundleId)) throw new Error('APP_BUNDLE_ID must be an explicit reverse-domain bundle identifier.');
  if (!/^[A-Z0-9]{10}$/.test(teamId)) throw new Error('TEAM_ID must be the 10-character Apple developer team identifier.');
  const api = client || createAppleClient({
    issuerId: required(env, 'APPSTORE_ISSUER_ID'),
    keyId: required(env, 'APPSTORE_KEY_ID'),
    privateKey: required(env, 'APPSTORE_PRIVATE_KEY'),
  });
  const query = (values) => new URLSearchParams(values).toString();
  // Read and verify the imported certificate before attempting any remote mutation.
  const certificates = await api.list(`/v1/certificates?${query({ 'filter[certificateType]': 'DISTRIBUTION,IOS_DISTRIBUTION', limit: '200' })}`);
  const certificate = selectDistributionCertificate(certificates, certificateSha1, teamId);
  const bundles = await api.list(`/v1/bundleIds?${query({ 'filter[identifier]': bundleId, limit: '200' })}`);
  const exactBundles = bundles.filter((bundle) => bundle.attributes?.identifier === bundleId);
  if (exactBundles.length > 1) throw new Error('Multiple exact bundle identifiers returned; refusing to guess.');
  let bundle = exactBundles[0];
  if (bundle && !['IOS', 'UNIVERSAL'].includes(bundle.attributes.platform)) throw new Error('Existing bundle identifier does not support iOS.');
  const actions = [];
  if (!bundle) {
    actions.push(`Register ${bundleId}`);
    if (apply) bundle = (await api.request('/v1/bundleIds', 'POST', {
      data: { type: 'bundleIds', attributes: { identifier: bundleId, name: env.APP_NAME || 'Bellywise', platform: 'IOS' } },
    })).data;
  }
  let profile;
  if (bundle) {
    const profiles = await api.list(`/v1/profiles?${query({ 'filter[profileType]': 'IOS_APP_STORE', 'filter[profileState]': 'ACTIVE', include: 'bundleId,certificates', limit: '200' })}`);
    profile = findMatchingProfile(profiles, bundle.id, certificate.id);
  }
  if (!profile) {
    actions.push('Create an App Store distribution profile for the verified certificate');
    if (apply) {
      if (!bundle?.id) throw new Error('Apple did not return the registered bundle identifier.');
      profile = (await api.request('/v1/profiles', 'POST', {
        data: {
          type: 'profiles',
          attributes: { name: `${env.APP_NAME || 'Bellywise'} App Store ${certificateSha1.slice(-8)} ${Date.now()}`, profileType: 'IOS_APP_STORE' },
          relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } }, certificates: { data: [{ type: 'certificates', id: certificate.id }] } },
        },
      })).data;
    }
  }
  const apps = await api.list(`/v1/apps?${query({ 'filter[bundleId]': bundleId, limit: '200' })}`);
  const exactApps = apps.filter((app) => app.attributes?.bundleId === bundleId);
  if (exactApps.length > 1) throw new Error('Multiple app records returned for this bundle identifier.');
  const app = exactApps[0];
  const manifest = {
    mode: apply ? 'apply' : 'read-only', bundleId, teamId, certificateSha1,
    bundleResourceId: bundle?.id || null, certificateId: certificate.id,
    profileId: profile?.id || null, profileUuid: profile?.attributes?.uuid || null,
    profileName: profile?.attributes?.name || null, appId: app?.id || null, actions,
    appRecordRequired: !app,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  if (profile) {
    if (!profile.attributes.profileContent) profile = (await api.request(`/v1/profiles/${encodeURIComponent(profile.id)}`)).data;
    const uuid = profile.attributes?.uuid;
    const content = profile.attributes?.profileContent;
    if (!/^[0-9A-Fa-f-]{36}$/.test(uuid || '') || typeof content !== 'string' || !content) throw new Error('Apple did not return a usable provisioning profile.');
    await writeFile(path.join(outputDir, `${uuid}.mobileprovision`), Buffer.from(content, 'base64'), { mode: 0o600 });
    await writeFile(path.join(outputDir, 'ExportOptions.plist'), exportOptions({ bundleId, profileUuid: uuid, teamId, certificateSha1 }), { mode: 0o600 });
  }
  if (env.GITHUB_OUTPUT) {
    const values = { bundle_id: bundleId, profile_uuid: manifest.profileUuid || '', app_id: manifest.appId || '', certificate_sha1: certificateSha1, app_record_required: String(!app) };
    await appendFile(env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${String(value).replace(/[\r\n]/g, '')}\n`).join(''));
  }
  return manifest;
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/ci/apple-setup.mjs [--apply] [--output-dir DIR]\nRequired environment: APPSTORE_ISSUER_ID, APPSTORE_KEY_ID, APPSTORE_PRIVATE_KEY, APP_BUNDLE_ID, TEAM_ID, CERTIFICATE_SHA1.\nWithout --apply: reads Apple resources and writes local signing metadata only. --apply can register the bundle identifier and create a matching profile. No certificates are created or revoked. App records must be created in App Store Connect.');
    return;
  }
  const index = process.argv.indexOf('--output-dir');
  if (index >= 0 && !process.argv[index + 1]) throw new Error('--output-dir requires a path.');
  const manifest = await prepareAppleSigning({ apply: process.argv.includes('--apply'), outputDir: index >= 0 ? process.argv[index + 1] : undefined });
  console.log(JSON.stringify(manifest, null, 2));
  if (manifest.appRecordRequired) console.log('Create the app record in App Store Connect for this bundle identifier before uploading. The public API cannot create it.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
