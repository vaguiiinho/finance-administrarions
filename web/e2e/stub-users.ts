/** Contrato do stub de e2e (ADR 0005 9.8, T11): usuarios semeados por `POST /__scenario` (qualquer cenario). Usado pelos specs e pelo Playwright. */
export type StubUserKey = "vagner" | "ana" | "carla" | "bruno";

export interface StubUser {
  key: StubUserKey;
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
  /** `bruno` nasce inativo (login responde INVALID_CREDENTIALS). */
  active: boolean;
  /** `carla` nasce com troca obrigatoria pendente (senha temporaria). */
  mustChangePassword: boolean;
}

export const STUB_USERS: Record<StubUserKey, StubUser> = {
  vagner: { key: "vagner", name: "Vagner", email: "vagner@exemplo.com", password: "Admin1234", role: "ADMIN", active: true, mustChangePassword: false },
  ana: { key: "ana", name: "Ana Souza", email: "ana@exemplo.com", password: "segredo123", role: "USER", active: true, mustChangePassword: false },
  carla: { key: "carla", name: "Carla Dias", email: "carla@exemplo.com", password: "Temp1234", role: "USER", active: true, mustChangePassword: true },
  bruno: { key: "bruno", name: "Bruno Lima", email: "bruno@exemplo.com", password: "segredo123", role: "USER", active: false, mustChangePassword: false },
};

/** Ordem de `GET /api/admin/users` (ativos antes de inativos, por nome: Ana, Carla, Vagner, depois Bruno). */
export const STUB_ADMIN_LIST_ORDER: StubUserKey[] = ["ana", "carla", "vagner", "bruno"];
