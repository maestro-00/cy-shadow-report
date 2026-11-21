#!/usr/bin/env node

// Help must run before config and Google clients load.
if (process.argv.includes('--help')) {
  const { printHelp } = await import('./src/printHelp.js');
  printHelp();
  process.exit(0);
}

try {
  const { run } = await import('./src/cliMain.js');
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not start qa-shadow-report.');
  process.exitCode = 1;
}
