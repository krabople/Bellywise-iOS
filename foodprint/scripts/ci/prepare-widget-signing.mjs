import { prepareAppleSigning, exportOptions } from './apple-setup.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run by the build workflow with its existing Apple credentials. Extensions need
// their own profile, but never a separate App Store Connect app record.
const outputDir = path.join(process.env.RUNNER_TEMP, 'bellywise-signing');
const main = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
const widget = await prepareAppleSigning({
  apply: true,
  outputDir: path.join(outputDir, 'widget'),
  env: { ...process.env, GITHUB_OUTPUT: undefined, APP_BUNDLE_ID: `${main.bundleId}.quicklog`, APP_NAME: 'Bellywise quick log' },
});
if (!main.profileUuid || !widget.profileUuid) throw new Error('Both app and widget signing profiles are required.');
const widgetOptions = exportOptions({ bundleId: widget.bundleId, profileUuid: widget.profileUuid, teamId: widget.teamId, certificateSha1: widget.certificateSha1 });
const widgetMapping = widgetOptions.match(/<key>provisioningProfiles<\/key><dict>(.*?)<\/dict>/)?.[1];
if (!widgetMapping) throw new Error('Widget export profile mapping is missing.');
const appOptions = await readFile(path.join(outputDir, 'ExportOptions.plist'), 'utf8');
await writeFile(path.join(outputDir, 'ExportOptions.plist'), appOptions.replace(/(<key>provisioningProfiles<\/key><dict>)(.*?)(<\/dict>)/, `$1$2${widgetMapping}$3`), { mode: 0o600 });
console.log('Prepared separate widget profile and combined app export mapping.');
