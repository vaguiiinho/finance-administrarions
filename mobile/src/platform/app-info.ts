import * as Application from 'expo-application';
import Constants from 'expo-constants';

/** Versao semver do binario (X-Client). Fora do app nativo, cai na versao do app.config. */
export function appVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
}

export function buildNumber(): string | null {
  return Application.nativeBuildVersion ?? null;
}

/** `Versao` em Ajustes: "1.0.0 (42)". */
export function versionLabel(): string {
  const build = buildNumber();
  return build ? `${appVersion()} (${build})` : appVersion();
}
