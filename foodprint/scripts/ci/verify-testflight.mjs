#!/usr/bin/env node
// Read-only verification of one iOS build. Does not add groups, testers or notifications.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createAppleClient } from './apple-setup.mjs';

export function readBuildSnapshot(response, { appId, buildNumber, marketingVersion }) {
  if (!Array.isArray(response.data)) throw new Error('Apple returned an invalid builds list.');
  const included = response.included || [];
  const matches = response.data.filter((build) => {
    const prereleaseId = build.relationships?.preReleaseVersion?.data?.id;
    const version = included.find((item) => item.type === 'preReleaseVersions' && item.id === prereleaseId);
    return build.attributes?.version === buildNumber
      && build.relationships?.app?.data?.id === appId
      && version?.attributes?.version === marketingVersion
      && version?.attributes?.platform === 'IOS';
  });
  if (matches.length > 1) throw new Error('More than one matching iOS build was returned; refusing to guess.');
  if (matches.length === 0) return { appId, buildNumber, marketingVersion, processingState: 'NOT_YET_VISIBLE', processingVerified: false };
  const build = matches[0];
  const detailId = build.relationships?.buildBetaDetail?.data?.id;
  const beta = included.find((item) => item.type === 'buildBetaDetails' && item.id === detailId);
  return {
    appId, buildId: build.id, buildNumber, marketingVersion,
    processingState: build.attributes.processingState,
    processingVerified: build.attributes.processingState === 'VALID' && !build.attributes.expired,
    expired: !!build.attributes.expired,
    uploadedDate: build.attributes.uploadedDate || null,
    internalBuildState: beta?.attributes?.internalBuildState || null,
    externalBuildState: beta?.attributes?.externalBuildState || null,
  };
}

export async function verifyProcessedBuild({ api, appId, buildNumber, marketingVersion, timeoutMs = 15 * 60_000, pollMs = 30_000, now = Date.now, sleep = delay, onObservation = async () => {} }) {
  if (!appId || !buildNumber || !marketingVersion) throw new Error('App ID, build number and marketing version are required to verify the exact build.');
  if (!(timeoutMs > 0) || !(pollMs > 0)) throw new Error('Polling durations must be positive.');
  const deadline = now() + timeoutMs;
  const query = new URLSearchParams({
    'filter[app]': appId,
    'filter[version]': buildNumber,
    'filter[preReleaseVersion.version]': marketingVersion,
    'filter[preReleaseVersion.platform]': 'IOS',
    include: 'app,preReleaseVersion,buildBetaDetail',
    limit: '10',
  });
  for (;;) {
    const response = await api.request(`/v1/builds?${query}`);
    const snapshot = { ...readBuildSnapshot(response, { appId, buildNumber, marketingVersion }), checkedAt: new Date(now()).toISOString() };
    await onObservation(snapshot);
    if (snapshot.expired) throw new Error('The matching TestFlight build is expired.');
    if (snapshot.processingVerified) return snapshot;
    if (['FAILED', 'INVALID'].includes(snapshot.processingState)) throw new Error(`Apple processing ended with ${snapshot.processingState} for the exact uploaded build.`);
    if (now() >= deadline) throw new Error(`Timed out waiting for Apple processing; latest state: ${snapshot.processingState}.`);
    await sleep(Math.min(pollMs, Math.max(1, deadline - now())));
  }
}

async function main() {
  const required = (name) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}.`);
    return value;
  };
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex < 0 ? null : process.argv[outputIndex + 1];
  if (outputIndex >= 0 && !outputPath) throw new Error('--output requires a path.');
  const api = createAppleClient({ issuerId: required('APPSTORE_ISSUER_ID'), keyId: required('APPSTORE_KEY_ID'), privateKey: required('APPSTORE_PRIVATE_KEY') });
  const result = await verifyProcessedBuild({
    api, appId: required('APPSTORE_APP_ID'), buildNumber: required('BUILD_NUMBER'), marketingVersion: required('MARKETING_VERSION'),
    onObservation: async (snapshot) => {
      console.log(`Build ${snapshot.marketingVersion} (${snapshot.buildNumber}): ${snapshot.processingState}`);
      if (outputPath) await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    },
  });
  console.log(JSON.stringify(result, null, 2));
  console.log('Apple processing verified. This check does not assign testers or establish that external beta review is complete.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
