import { jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./postInstall.js', import.meta.url));
const originalArgv = process.argv;
const originalExitCode = process.exitCode;

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  jest.restoreAllMocks();
});

const runSetup = async ({
  installationError,
  statusError,
  statusContent = 'return false;',
  answers = ['cy', 'n', 'npm'],
} = {}) => {
  jest.resetModules();
  const close = jest.fn();
  const question = jest.fn((_, callback) => callback(answers.shift()));
  const execSync = jest.fn(() => {
    if (installationError) throw installationError;
  });
  const writeFileSync = jest.fn(() => {
    if (statusError) throw statusError;
  });
  jest.unstable_mockModule('fs', () => ({
    default: {
      realpathSync: (value) => value,
      readFileSync: () => statusContent,
      writeFileSync,
    },
  }));
  jest.unstable_mockModule('child_process', () => ({ execSync }));
  jest.unstable_mockModule('readline', () => ({
    default: { createInterface: () => ({ question, close }) },
  }));
  jest.unstable_mockModule('../src/utils/projectPaths.js', () => ({
    findProjectRoot: () => '/project',
    getModulePaths: () => ({ dirname: '/project/scripts', filename: script }),
  }));
  jest.unstable_mockModule('./configuredStatus.js', () => ({
    isProjectConfigured: () => false,
  }));
  process.argv = ['node', script];
  const stderr = jest.spyOn(console, 'error').mockImplementation(() => {});
  const stdout = jest.spyOn(console, 'info').mockImplementation(() => {});
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const { installPackages } = await import('./postInstall.js');
  return { close, exit, installPackages, stderr, stdout, writeFileSync };
};

it('reports installation failure once, preserves its cause and stops setup', async () => {
  const cause = new Error('npm failed');
  const result = await runSetup({ installationError: cause });
  expect(result.stderr).toHaveBeenCalledTimes(1);
  expect(result.stderr).toHaveBeenCalledWith(expect.stringContaining('Failed to install packages with npm.'));
  expect(result.writeFileSync).not.toHaveBeenCalled();
  expect(result.stdout).not.toHaveBeenCalledWith(expect.stringContaining('setup complete'));
  expect(result.close).toHaveBeenCalledTimes(1);
  expect(process.exitCode).toBe(1);
  expect(() => result.installPackages('npm')).toThrow(expect.objectContaining({ cause }));
});

it('reports status persistence failure before announcing completion', async () => {
  const result = await runSetup({ statusError: new Error('disk full') });
  expect(result.stderr).toHaveBeenCalledTimes(1);
  expect(result.stderr).toHaveBeenCalledWith(expect.stringContaining('Failed to update setup status'));
  expect(result.stdout).not.toHaveBeenCalledWith(expect.stringContaining('setup complete'));
  expect(result.close).toHaveBeenCalledTimes(1);
  expect(process.exitCode).toBe(1);
});

it('persists setup status before announcing success', async () => {
  const result = await runSetup();
  expect(result.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'return true;', 'utf8');
  expect(result.stdout).toHaveBeenCalledWith(expect.stringContaining('setup complete'));
  expect(result.stderr).not.toHaveBeenCalled();
  expect(result.close).toHaveBeenCalledTimes(1);
});

it('leaves the setup status alone when the user cancels', async () => {
  const result = await runSetup({ answers: ['', 'y'] });
  expect(result.writeFileSync).not.toHaveBeenCalled();
  expect(result.exit).toHaveBeenCalledWith(0);
  expect(result.stderr).not.toHaveBeenCalled();
});

it('rejects unrecognized status files before reporting completion', async () => {
  const result = await runSetup({ statusContent: 'unexpected contents' });
  expect(result.writeFileSync).not.toHaveBeenCalled();
  expect(result.stderr).toHaveBeenCalledTimes(1);
  expect(result.stdout).not.toHaveBeenCalledWith(expect.stringContaining('setup complete'));
  expect(process.exitCode).toBe(1);
});
