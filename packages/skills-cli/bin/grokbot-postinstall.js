#!/usr/bin/env node
import { runGrokBotPostinstall } from '../dist/cli/grokbot-postinstall.js';

try {
  process.stdout.write(`${await runGrokBotPostinstall()}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
