module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/**/*.test.js'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  testMatch: ['**/test/**/*.test.js', '**/src/**/*.test.js'],
  coverageReporters: ['text', 'lcov', 'json-summary']
};
