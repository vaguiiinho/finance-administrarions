import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuracao do app (ADR 0011 10.1, 10.7). Valores marcados com PLACEHOLDER precisam ser definidos antes do primeiro
 * build no EAS (conta Apple, projeto EAS, dominio da API).
 *  - APP_VARIANT=development: libera rede local (API em http://localhost) so no build de desenvolvimento.
 *  - APP_VARIANT=e2e: inclui a tela /diagnostics (CA15/CA18); nunca entra no perfil de producao.
 */
const variant = process.env.APP_VARIANT ?? 'production';
const allowLocalNetworking = variant === 'development' || variant === 'e2e';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Finanças Pessoais',
  slug: 'finance-administrations-mobile',
  scheme: 'financas',
  // Hermes e a New Architecture sao o padrao do SDK 58 (nao configuraveis).
  // Semver do binario: vai em `X-Client: mobile/<versao>` (T7). O `buildNumber` e incrementado pelo EAS (eas.json).
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['ios'],
  ios: {
    // PLACEHOLDER: o mesmo `appId` dos fluxos Maestro (e2e/maestro). Troque pelo identificador registrado na conta Apple.
    bundleIdentifier: 'br.com.finance.app',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // ATS (CA30): so HTTPS; "rede local" apenas nos builds de desenvolvimento/e2e.
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: allowLocalNetworking },
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    // ADR 0011 pede iOS 16.0, mas o Expo SDK 58 / React Native 0.88 exigem no minimo 16.4 (o plugin recusa menos).
    ['expo-build-properties', { ios: { deploymentTarget: '16.4' } }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    appVariant: variant,
    // PLACEHOLDER: `eas init` preenche o projeto.
    eas: { projectId: 'REPLACE-WITH-EAS-PROJECT-ID' },
  },
});
