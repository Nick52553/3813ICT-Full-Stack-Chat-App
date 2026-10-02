// Mocha configuration - `npm test` runs every *.test.js file
// in test/, after test/setup.js has pointed the app at a
// separate test database.
module.exports = {
  require: ['test/setup.js'],
  spec: ['test/**/*.test.js'],
  timeout: 10000,
  exit: true
};
