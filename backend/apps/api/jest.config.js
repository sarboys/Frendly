const base = require('../../jest.preset');

module.exports = {
  ...base,
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
