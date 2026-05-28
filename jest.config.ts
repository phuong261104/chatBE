/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: "(tests/.+)\\.test\\.ts$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@share/(.*)$": "<rootDir>/src/share/$1",
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/tests/live-server-session-social.test.ts",
  ],
  collectCoverageFrom: [
    "src/modules/chat/**/*.ts",
    "!src/modules/chat/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
