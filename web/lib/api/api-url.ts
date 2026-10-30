/** `API_URL` so existe no servidor: o navegador nunca chama a API (ADR 0005 9.2, 9.9). Lida a cada chamada. */
export const apiBaseUrl = (): string => (process.env.API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
