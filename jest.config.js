/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  // Mirror the tsconfig "@/*" alias so route handlers can be tested directly.
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
};
