// A launch that asked for no focus never shows Electron's error box for a main-process
// error (that box is modal and takes focus); the error goes to stderr and the app ends.
// A person's launch keeps the box: it is the only way they would learn of the error.
//
// main.ts imports this module first, so it is evaluated before every other module of the
// bundle and an error thrown while any of them loads reaches the handler: Electron hands a
// failed ESM main to process 'uncaughtException' (triggerUncaughtException in its loader),
// and its own error box only shows when no other listener is registered.
if (process.argv.includes('--no-activate')) {
  process.on('uncaughtException', (error) => {
    process.stderr.write(`main process error (no dialog under --no-activate): ${error?.stack ?? String(error)}\n`);
    process.exit(70);
  });
}

export {};
