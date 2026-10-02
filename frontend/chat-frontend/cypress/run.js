// Starts Cypress:
//   node cypress/run.js          run the e2e tests (headless)
//   node cypress/run.js open     interactive Cypress window
//   node cypress/run.js docs     take the storyboard screenshots
//                                into docs/screenshots/
//
// Some editors and tools built on Electron (e.g. VS Code
// extensions) set ELECTRON_RUN_AS_NODE=1 for their child
// processes. Cypress is itself an Electron app, so with that
// set it starts as plain Node and fails with "bad option:
// --smoke-test". Clearing it here makes `npm run e2e` work
// from any terminal.

delete process.env.ELECTRON_RUN_AS_NODE;

const fs = require('fs');
const path = require('path');
const cypress = require('cypress');

const mode = process.argv[2] || 'run';

const DOCS_SPEC = 'cypress/docs/storyboard.cy.js';
const SHOTS_TMP = path.join(__dirname, 'docs-screenshots');
const SHOTS_OUT = path.join(__dirname, '../../../docs/screenshots');

// Copy every screenshot into docs/screenshots/, replacing
// the previous set.
function publishScreenshots() {

  fs.mkdirSync(SHOTS_OUT, { recursive: true });

  for (const old of fs.readdirSync(SHOTS_OUT)) {
    if (old.endsWith('.png')) {
      fs.unlinkSync(path.join(SHOTS_OUT, old));
    }
  }

  const files = fs.readdirSync(SHOTS_TMP, { recursive: true })
    .filter(file => file.endsWith('.png'));

  for (const file of files) {
    fs.copyFileSync(path.join(SHOTS_TMP, file), path.join(SHOTS_OUT, path.basename(file)));
  }

  fs.rmSync(SHOTS_TMP, { recursive: true, force: true });
  console.log(`Saved ${files.length} screenshots to ${SHOTS_OUT}`);
}

function start() {

  if (mode === 'open') {
    return cypress.open();
  }

  if (mode === 'docs') {
    return cypress.run({
      spec: DOCS_SPEC,
      config: {
        specPattern: DOCS_SPEC,
        screenshotsFolder: SHOTS_TMP,
        // Only keep the pictures we ask for (set
        // SHOT_FAILURES=1 to also capture failures).
        screenshotOnRunFailure: Boolean(process.env.SHOT_FAILURES)
      }
    });
  }

  return cypress.run();
}

start()
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

    if (mode === 'docs' && result.totalFailed === 0) {
      publishScreenshots();
    }

    process.exit(result.totalFailed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
