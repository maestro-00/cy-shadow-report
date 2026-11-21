import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
let directory;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'qasr-startup-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const run = (source, ...args) => {
  const config = join(directory, 'config.mjs');
  writeFileSync(config, source);
  const env = { ...process.env, CI: 'true' };
  delete env.JEST_WORKER_ID;
  return spawnSync(process.execPath, [cli, '--config', config, ...args], {
    encoding: 'utf8',
    env,
    timeout: 30000,
  });
};

it('reports malformed configuration once and exits unsuccessfully', () => {
  const result = run('export default {', 'cypress', '--csv');
  expect(result.status).toBe(1);
  expect(result.stderr.trim().split('\n')).toEqual([
    expect.stringContaining('Could not load configuration'),
  ]);
});

it('loads help without importing malformed configuration', () => {
  const result = run('export default {', '--help');
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
});

it('stops after one diagnostic for an invalid configuration field', () => {
  const result = run('export default { testData: 123 }', 'cypress', '--csv');
  expect(result.status).toBe(1);
  expect(result.stderr.match(/Configuration validation failed/g)).toHaveLength(1);
  expect(result.stderr).toContain('Invalid value for');
  expect(result.stderr).toContain('testData');
  expect(result.stderr).not.toContain('Error executing command');
});

it('reports missing test results once in CSV mode without Google credentials', () => {
  const missing = join(directory, 'missing.json');
  const result = run(`export default { testData: ${JSON.stringify(missing)} }`, 'cypress', '--csv');
  expect(result.status).toBe(1);
  expect(result.stderr.trim().split('\n')).toEqual([
    expect.stringContaining(`Test results file not found at ${missing}`),
  ]);
});
