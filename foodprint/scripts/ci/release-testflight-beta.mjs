#!/usr/bin/env node
// Idempotently submit one processed build for external TestFlight review and invite one tester.
// The tester email is read from a secret and is never printed or written to artifacts.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAppleClient } from './apple-setup.mjs';

const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
};

const linkage = (type, id) => ({ type, id });

export function classifyTesterInvitationError(error) {
  const message = String(error?.message || '');
  if (message.includes('STATE_ERROR.TESTER_INVITE.NO_INSTALLABLE_BUILDS')) return 'deferred';
  if (message.includes('STATE_ERROR.TESTER_INVITE.ALREADY_ACCEPTED')) return 'already-accepted';
  return null;
}

export async function releaseExternalBeta({ api, appId, buildId, groupId, testerEmail }) {
  const normalizedEmail = testerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('The configured tester email is invalid.');

  const [buildResponse, groupResponse, localizationResponse, reviewDetailResponse] = await Promise.all([
    api.request(`/v1/builds/${encodeURIComponent(buildId)}?include=app,buildBetaDetail`),
    api.request(`/v1/betaGroups/${encodeURIComponent(groupId)}?include=app`),
    api.request(`/v1/apps/${encodeURIComponent(appId)}/betaAppLocalizations?limit=200`),
    api.request(`/v1/apps/${encodeURIComponent(appId)}/betaAppReviewDetail`),
  ]);

  const build = buildResponse.data;
  const group = groupResponse.data;
  if (build?.type !== 'builds' || build.relationships?.app?.data?.id !== appId) throw new Error('The configured build does not belong to the configured app.');
  if (build.attributes?.processingState !== 'VALID' || build.attributes?.expired) throw new Error('The configured build is not a valid, unexpired build.');
  if (group?.type !== 'betaGroups' || group.relationships?.app?.data?.id !== appId) throw new Error('The configured beta group does not belong to the configured app.');
  if (group.attributes?.isInternalGroup) throw new Error('The configured beta group is internal, not external.');
  if (!Array.isArray(localizationResponse.data) || !localizationResponse.data.some((item) => item.attributes?.description?.trim())) {
    throw new Error('A beta app localization description is required before external review.');
  }

  const reviewDetail = reviewDetailResponse.data;
  if (reviewDetail?.type !== 'betaAppReviewDetails') throw new Error('The beta review details resource is unavailable.');
  const contact = reviewDetail.attributes || {};
  for (const key of ['contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail']) {
    if (!String(contact[key] || '').trim()) throw new Error(`Beta review details are missing ${key}.`);
  }
  if (contact.demoAccountRequired !== false) {
    await api.request(`/v1/betaAppReviewDetails/${encodeURIComponent(reviewDetail.id)}`, 'PATCH', {
      data: { type: 'betaAppReviewDetails', id: reviewDetail.id, attributes: { demoAccountRequired: false } },
    });
  }

  const betaDetailId = build.relationships?.buildBetaDetail?.data?.id;
  if (!betaDetailId) throw new Error('The build beta details resource is unavailable.');
  await api.request(`/v1/buildBetaDetails/${encodeURIComponent(betaDetailId)}`, 'PATCH', {
    data: { type: 'buildBetaDetails', id: betaDetailId, attributes: { autoNotifyEnabled: true } },
  });

  const existingGroupBuilds = await api.request(`/v1/betaGroups/${encodeURIComponent(groupId)}/relationships/builds?limit=200`);
  if (!existingGroupBuilds.data?.some((item) => item.id === buildId)) {
    await api.request(`/v1/betaGroups/${encodeURIComponent(groupId)}/relationships/builds`, 'POST', {
      data: [linkage('builds', buildId)],
    });
  }

  let submissions = await api.request(`/v1/betaAppReviewSubmissions?filter[build]=${encodeURIComponent(buildId)}&limit=10`);
  let submission = submissions.data?.[0];
  if (!submission) {
    const created = await api.request('/v1/betaAppReviewSubmissions', 'POST', {
      data: {
        type: 'betaAppReviewSubmissions',
        relationships: { build: { data: linkage('builds', buildId) } },
      },
    });
    submission = created.data;
  }

  const testerQuery = new URLSearchParams({ 'filter[email]': normalizedEmail, 'filter[apps]': appId, include: 'betaGroups', limit: '10' });
  const testerResponse = await api.request(`/v1/betaTesters?${testerQuery}`);
  const exactTesters = (testerResponse.data || []).filter((item) => item.attributes?.email?.trim().toLowerCase() === normalizedEmail);
  if (exactTesters.length > 1) throw new Error('Multiple exact tester records were returned; refusing to guess.');
  let tester = exactTesters[0];
  if (!tester) {
    const created = await api.request('/v1/betaTesters', 'POST', {
      data: {
        type: 'betaTesters',
        attributes: { email: normalizedEmail },
        relationships: { betaGroups: { data: [linkage('betaGroups', groupId)] } },
      },
    });
    tester = created.data;
  } else {
    const testerGroups = await api.request(`/v1/betaTesters/${encodeURIComponent(tester.id)}/relationships/betaGroups?limit=200`);
    if (!testerGroups.data?.some((item) => item.id === groupId)) {
      await api.request(`/v1/betaTesters/${encodeURIComponent(tester.id)}/relationships/betaGroups`, 'POST', {
        data: [linkage('betaGroups', groupId)],
      });
    }
  }

  let invitation = null;
  let invitationDeferredUntilBuildInstallable = false;
  let invitationAlreadyAccepted = false;
  try {
    invitation = await api.request('/v1/betaTesterInvitations', 'POST', {
      data: {
        type: 'betaTesterInvitations',
        relationships: {
          app: { data: linkage('apps', appId) },
          betaTester: { data: linkage('betaTesters', tester.id) },
        },
      },
    });
  } catch (error) {
    const invitationError = classifyTesterInvitationError(error);
    if (invitationError === 'deferred') {
      // The first external build must pass Beta App Review. autoNotifyEnabled queues the email for approval.
      invitationDeferredUntilBuildInstallable = true;
    } else if (invitationError === 'already-accepted') {
      // Apple rejects duplicate invitations after a tester has already accepted access.
      invitationAlreadyAccepted = true;
    } else {
      throw error;
    }
  }

  submissions = await api.request(`/v1/betaAppReviewSubmissions?filter[build]=${encodeURIComponent(buildId)}&limit=10`);
  const finalTester = await api.request(`/v1/betaTesters/${encodeURIComponent(tester.id)}?include=betaGroups`);
  const finalDetail = await api.request(`/v1/buildBetaDetails/${encodeURIComponent(betaDetailId)}`);
  const groupBuilds = await api.request(`/v1/betaGroups/${encodeURIComponent(groupId)}/relationships/builds?limit=200`);
  const testerGroups = await api.request(`/v1/betaTesters/${encodeURIComponent(tester.id)}/relationships/betaGroups?limit=200`);
  const finalSubmission = submissions.data?.[0] || submission;

  const result = {
    appId,
    buildId,
    buildNumber: build.attributes?.version || null,
    groupId,
    buildAssignedToExternalGroup: !!groupBuilds.data?.some((item) => item.id === buildId),
    autoNotifyEnabled: finalDetail.data?.attributes?.autoNotifyEnabled === true,
    externalBuildState: finalDetail.data?.attributes?.externalBuildState || null,
    betaReviewState: finalSubmission?.attributes?.betaReviewState || null,
    betaReviewSubmissionId: finalSubmission?.id || null,
    testerId: tester.id,
    testerState: finalTester.data?.attributes?.state || null,
    testerInviteType: finalTester.data?.attributes?.inviteType || null,
    testerAssignedToExternalGroup: !!testerGroups.data?.some((item) => item.id === groupId),
    invitationRequested: invitation?.data?.type === 'betaTesterInvitations',
    invitationId: invitation?.data?.id || null,
    invitationDeferredUntilBuildInstallable,
    invitationAlreadyAccepted,
    verifiedAt: new Date().toISOString(),
  };
  if (!result.buildAssignedToExternalGroup || !result.autoNotifyEnabled || !result.testerAssignedToExternalGroup
    || (!result.invitationRequested && !result.invitationDeferredUntilBuildInstallable && !result.invitationAlreadyAccepted)) {
    throw new Error('Apple did not confirm every requested TestFlight relationship.');
  }
  return result;
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex < 0 ? null : process.argv[outputIndex + 1];
  if (outputIndex >= 0 && !outputPath) throw new Error('--output requires a path.');
  const env = process.env;
  const api = createAppleClient({
    issuerId: required(env, 'APPSTORE_ISSUER_ID'),
    keyId: required(env, 'APPSTORE_KEY_ID'),
    privateKey: required(env, 'APPSTORE_PRIVATE_KEY'),
  });
  const result = await releaseExternalBeta({
    api,
    appId: required(env, 'APPSTORE_APP_ID'),
    buildId: required(env, 'APPSTORE_BUILD_ID'),
    groupId: required(env, 'APPSTORE_EXTERNAL_GROUP_ID'),
    testerEmail: required(env, 'TESTFLIGHT_TESTER_EMAIL'),
  });
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
