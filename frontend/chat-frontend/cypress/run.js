// Starts Cypress (`run`, or `open` for the interactive UI).
//
// Some editors and tools built on Electron (e.g. VS Code
// extensions) set ELECTRON_RUN_AS_NODE=1 for their child
// processes. Cypress is itself an Electron app, so with that
// set it starts as plain Node and fails with "bad option:
// --smoke-test". Clearing it here makes `npm run e2e` work
// from any terminal.

delete process.env.ELECTRON_RUN_AS_NODE;

const cypress = require('cypress');

const mode = process.argv[2] === 'open' ? 'open' : 'run';

cypress[mode]()
  .then(result => {

    // `open` resolves when the window is closed.
    if (mode === 'open') {
      return;
    }

    // Couldn't start at all (e.g. no browser).
    if (result.status === 'failed') {
      console.error(result.message);
      process.exit(1);
    }

    process.exit(result.totalFailed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
