/** Portas do app (ADR 0011 10.2). `src/core` nao importa react, react-native nem expo-*. */
export interface StoredSession {
  token: string;
  expiresAt: string;
}
export interface TokenStore {
  read(): Promise<StoredSession | null>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}
export interface Clock {
  now(): Date;
}
export interface ExternalBrowser {
  open(url: string): Promise<void>;
}
