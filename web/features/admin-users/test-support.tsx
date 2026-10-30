import type { AdminUserDto } from "@/lib/api/types";

/** Fabrica de usuarios da gestao para os specs de features/admin-users. */
export const adminUser = (over: Partial<AdminUserDto> = {}): AdminUserDto => ({
  id: "0192f1e2-0000-7000-8000-0000000000a1",
  name: "Ana Souza",
  email: "ana@exemplo.com",
  role: "USER",
  status: "ACTIVE",
  mustChangePassword: false,
  createdAt: "2026-10-29T12:00:00.000Z",
  ...over,
});

export const VAGNER = adminUser({ id: "0192f1e2-0000-7000-8000-0000000000a0", name: "Vagner", email: "vagner@exemplo.com", role: "ADMIN", createdAt: "2026-10-28T12:00:00.000Z" });
export const ANA = adminUser({ mustChangePassword: true });
export const CARLA = adminUser({ id: "0192f1e2-0000-7000-8000-0000000000a2", name: "Carla Dias", email: "carla@exemplo.com", createdAt: "2026-10-30T02:30:00.000Z" });
export const BRUNO = adminUser({ id: "0192f1e2-0000-7000-8000-0000000000a3", name: "Bruno Lima", email: "bruno@exemplo.com", status: "INACTIVE" });
