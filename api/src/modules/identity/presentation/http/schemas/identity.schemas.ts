import { z } from 'zod';

/** Formas (strict) dos corpos; regras de negócio (tamanhos, formato, nível) ficam no domínio. */
export const loginBodySchema = z.strictObject({ email: z.string(), password: z.string() });
export const changePasswordBodySchema = z.strictObject({ currentPassword: z.string(), newPassword: z.string() });
export const profileBodySchema = z.strictObject({ name: z.string() });
export const createUserBodySchema = z.strictObject({
  name: z.string(),
  email: z.string(),
  role: z.string(),
  password: z.string(),
});
export const updateUserBodySchema = z.strictObject({ name: z.string(), email: z.string(), role: z.string() });
export const resetPasswordBodySchema = z.strictObject({ password: z.string() });

export type LoginBody = z.infer<typeof loginBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type ProfileBody = z.infer<typeof profileBodySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
