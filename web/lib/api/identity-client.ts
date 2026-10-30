import "server-only";
import { request } from "./http";
import type { AdminUserDto, AuthResponse, CurrentUserDto } from "./types";

const enc = encodeURIComponent;

/** Chamadas A1-A5 e U1-U7 (ADR 0005 6.2). Ids de path sempre codificados (anti path injection). */
export const login = (email: string, password: string) => request<AuthResponse>("POST", "/auth/login", { body: { email, password }, auth: "none" });
export const logout = () => request<void>("POST", "/auth/logout");
export const fetchMe = () => request<CurrentUserDto>("GET", "/auth/me");
/** A confirmacao da nova senha e so do web: nunca vai a API (RF08). */
export const changePassword = (currentPassword: string, newPassword: string) => request<CurrentUserDto>("PUT", "/account/password", { body: { currentPassword, newPassword } });
export const updateProfile = (name: string) => request<CurrentUserDto>("PUT", "/account/profile", { body: { name } });

export const listUsers = () => request<{ items: AdminUserDto[] }>("GET", "/admin/users");
export const getUser = (id: string) => request<AdminUserDto>("GET", `/admin/users/${enc(id)}`);
export const createUser = (input: { name: string; email: string; role: string; password: string }) => request<AdminUserDto>("POST", "/admin/users", { body: input });
export const updateUser = (id: string, input: { name: string; email: string; role: string }) => request<AdminUserDto>("PUT", `/admin/users/${enc(id)}`, { body: input });
export const deactivateUser = (id: string) => request<AdminUserDto>("POST", `/admin/users/${enc(id)}/deactivate`);
export const reactivateUser = (id: string) => request<AdminUserDto>("POST", `/admin/users/${enc(id)}/reactivate`);
export const resetUserPassword = (id: string, password: string) => request<AdminUserDto>("POST", `/admin/users/${enc(id)}/password-reset`, { body: { password } });
