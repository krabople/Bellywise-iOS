// Run once from the owner’s authenticated workstation. Existing Apple secrets are never read.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const source = 'krabople/Bellywise-iOS';
const signing = 'krabople/Lifetwine';
function command(bin, args, input) {
  const result = spawnSync(bin, args, { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${bin} failed: ${result.stderr || result.error?.message || 'unknown error'}`);
  return result.stdout;
}
const temp = mkdtempSync(join(tmpdir(), 'bellywise-deploy-'));
try {
  const key = join(temp, 'source-key');
  command('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'Bellywise source read-only build key', '-f', key]);
  command('gh', ['repo', 'deploy-key', 'add', `${key}.pub`, '--repo', source, '--title', 'Bellywise read-only source for Apple build']);
  command('gh', ['secret', 'set', 'BELLYWISE_SOURCE_DEPLOY_KEY', '--repo', signing], readFileSync(key));
  const workflow = readFileSync(new URL('../../docs/bellywise-testflight.workflow.yml', import.meta.url), 'utf8');
  const endpoint = `repos/${signing}/contents/.github/workflows/bellywise-testflight.yml`;
  const existing = spawnSync('gh', ['api', endpoint], { encoding: 'utf8', windowsHide: true });
  const sha = existing.status === 0 ? JSON.parse(existing.stdout).sha : undefined;
  const payload = JSON.stringify({ message: 'Add isolated Bellywise TestFlight build using existing signing setup', content: Buffer.from(workflow).toString('base64'), ...(sha ? { sha } : {}) });
  command('gh', ['api', '--method', 'PUT', endpoint, '--input', '-'], payload);
  console.log('Installed isolated Bellywise workflow and read-only source key. Existing Apple signing secrets remained in GitHub.');
} finally {
  // The resolved temporary directory is created above and used only for this keypair.
  for (const name of ['source-key', 'source-key.pub']) rmSync(join(temp, name), { force: true });
  rmdirSync(temp);
}
