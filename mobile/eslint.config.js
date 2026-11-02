// ESLint (flat config) com a configuracao do Expo + a regra de dependencia do ADR 0011 10.2:
// `src/lib` e `src/core` nao importam react, react-native, expo-*, src/data nem src/platform;
// `src/data` nunca usa `expo-secure-store` diretamente.
const expoConfig = require('eslint-config-expo/flat');

const noPlatform = {
  patterns: [
    {
      group: ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@react-native*', '@expo/*'],
      message: 'src/lib e src/core sao TypeScript puro (ADR 0011 10.2).',
    },
    {
      group: ['@/data', '@/data/*', '@/platform', '@/platform/*', '@/features/*', '@/ui/*'],
      message: 'src/lib e src/core nao dependem de data, platform, features nem ui.',
    },
  ],
};

module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', 'node_modules/*', 'ios/*', 'android/*', '.expo/*', 'coverage/*'] },
  {
    files: ['src/lib/**/*.ts', 'src/core/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: { 'no-restricted-imports': ['error', noPlatform] },
  },
  {
    files: ['src/data/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['expo-secure-store'], message: 'Use a porta TokenStore (src/platform).' }] }] },
  },
  {
    files: ['**/*.spec.ts', '__tests__/**/*', 'vitest.config.ts', 'jest.config.js', 'babel.config.js', 'scripts/**/*', 'eslint.config.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Testes escritos pelo tester: avisos de estilo nao bloqueiam.
    files: ['__tests__/**/*'],
    rules: { 'import/no-duplicates': 'off', 'import/first': 'off', '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
];
