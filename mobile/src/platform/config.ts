/** Configuracao publica (EXPO_PUBLIC_*), lida na chamada (o Metro inlina o acesso literal a `process.env.EXPO_PUBLIC_*`). */
export const apiUrl = (): string => process.env.EXPO_PUBLIC_API_URL ?? '';
export const webUrl = (): string => process.env.EXPO_PUBLIC_WEB_URL ?? '';
export const privacyUrl = (): string => `${webUrl()}/privacy`;
export const supportUrl = (): string => `${webUrl()}/support`;
export const webLoginUrl = (): string => `${webUrl()}/login`;
