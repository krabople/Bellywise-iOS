// Update only the isolated Bellywise workflow; leave existing signing secrets alone.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function gh(args, input) {
  const result = spawnSync('gh', args, { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'GitHub command failed');
  return JSON.parse(result.stdout);
}
const endpoint = 'repos/krabople/Lifetwine/contents/.github/workflows/bellywise-testflight.yml';
const existing = gh(['api', endpoint]);
const workflow = readFileSync(new URL('../../docs/bellywise-testflight.workflow.yml', import.meta.url));
const updated = gh(['api', '--method', 'PUT', endpoint, '--input', '-'], JSON.stringify({
  message: 'Verify Bellywise native startup and exact TestFlight processing',
  sha: existing.sha,
  content: workflow.toString('base64'),
}));
console.log(`Updated isolated Bellywise workflow: ${updated.commit.sha}`);
