import { SetMetadata } from '@nestjs/common';
import type { PrincipalRole } from './principal.js';

export const IS_PUBLIC_KEY = Symbol('IS_PUBLIC');
export const ALLOW_DURING_PASSWORD_CHANGE_KEY = Symbol('ALLOW_DURING_PASSWORD_CHANGE');
export const REQUIRED_ROLE_KEY = Symbol('REQUIRED_ROLE');

/** Rota sem autenticação (login, logout, leituras da demo). O padrão é protegida (seguro por padrão). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Rota liberada enquanto a troca obrigatória de senha estiver pendente (ADR 0005 6.6). */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);

/** Exige o nível informado, lido do banco a cada requisição (T16). */
export const RequireRole = (role: PrincipalRole) => SetMetadata(REQUIRED_ROLE_KEY, role);
