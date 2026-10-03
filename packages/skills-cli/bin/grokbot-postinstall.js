#!/usr/bin/env node
if (process.env.npm_config_global !== 'true' || process.env.npm_lifecycle_event !== 'postinstall') {
  process.stdout.write('Grok Bot account library untouched (not a global npm install).\n');
} else {
  try {
    const { runGrokBotPostinstall } = await import('../dist/cli/grokbot-postinstall.js');
    process.stdout.write(`${await runGrokBotPostinstall()}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
