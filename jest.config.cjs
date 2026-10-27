module.exports = {
    testEnvironment: "node",
    roots: [
        "<rootDir>/test",
        "<rootDir>/src"
    ],
    testMatch: [
        "**/*.test.js"
    ],
    setupFilesAfterEnv: [
        "<rootDir>/test/setup/jest.setup.js"
    ],
    globalSetup:
        "<rootDir>/test/setup/globalSetup.js",
    globalTeardown:
        "<rootDir>/test/setup/globalTeardown.js",
    collectCoverage: true,
    coverageDirectory: "coverage",
    collectCoverageFrom: [
        "src/**/*.js",
        "!src/index.js"
    ],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 70,
            lines: 60,
            statements: 60
        }
    }
};