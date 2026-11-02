// Telas, data layer e plataforma: jest-expo + RNTL + MSW (ADR 0011 11.3).
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/support/setup.ts'],
  transform: { '\\.mjs$': 'babel-jest' },
  // Muitos pacotes do ecossistema Expo/React Navigation publicam ESM: transforma tudo exceto o runtime do jest.
  transformIgnorePatterns: ['/node_modules/(?=(jest|@jest|babel-jest)/)'],
  moduleNameMapper: {
    // msw/node tem "react-native": null nas export conditions do preset; aponta direto para o build CJS.
    '^msw/node$': '<rootDir>/node_modules/msw/lib/node/index.js', '^@/(.*)$': '<rootDir>/src/$1' },
};
