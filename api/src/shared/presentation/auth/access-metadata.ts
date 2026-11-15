import { SetMetadata } from '@nestjs/common';
import type { PrincipalCapability } from './principal.js';

export const IS_PUBLIC_KEY = Symbol('IS_PUBLIC');
export const ALLOW_DURING_PASSWORD_CHANGE_KEY = Symbol('ALLOW_DURING_PASSWORD_CHANGE');
export const REQUIRED_CAPABILITY_KEY = Symbol('REQUIRED_CAPABILITY');

/** Rota sem autenticação (login, logout). O padrão é protegida (seguro por padrão). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Rota liberada enquanto a troca obrigatória de senha estiver pendente (ADR 0005 6.6). */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);

/** Exige a capacidade informada, derivada do tipo de conta e do nível lidos do banco a cada requisição (T16). */
export const RequireCapability = (capability: PrincipalCapability) => SetMetadata(REQUIRED_CAPABILITY_KEY, capability);
