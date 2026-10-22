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
],
};