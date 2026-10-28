module.exports = {
    testEnvironment: "node",

    roots: [
        "<rootDir>/test/unit"
    ],

    testMatch: [
        "**/*.test.js"
    ],

    setupFilesAfterEnv: [
        "<rootDir>/test/setup/jest.setup.js"
    ],

    collectCoverage: true,

    coverageDirectory: "coverage/unit",

    collectCoverageFrom: [
    "src/conference-management/**/*.js",
    "src/Shared/Infrastructure/ai/**/*.js",
    "src/Shared/Infrastructure/messaging/outbox/PostgresOutboxRepository.js",
    ],

    coverageThreshold: {
        global: {
            statements: 60,
            branches: 60,
            functions: 60,
            lines: 60,
        },
    },
};