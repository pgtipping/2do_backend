module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts", "**/*.test.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFiles: ["<rootDir>/tests/setup.js"],
  collectCoverageFrom: [
    "models/**/*.{js,ts}",
    "utils/**/*.{js,ts}",
    "llm/**/*.{js,ts}",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
