// A stand-in command-line tool for tests. The first argument picks a behaviour.
'use strict';

const [mode] = process.argv.slice(2);
if (mode === 'echo') process.stdout.write(JSON.stringify(process.argv.slice(2)));
else if (mode === 'hang') setInterval(() => {}, 1000);
else if (mode === 'flood') process.stdout.write('x'.repeat(256 * 1024));
else if (mode === 'fail') {
  process.stderr.write('it broke');
  process.exit(3);
} else if (mode === '--version') process.stdout.write('0.0.0-test\n');
else process.exit(2);
