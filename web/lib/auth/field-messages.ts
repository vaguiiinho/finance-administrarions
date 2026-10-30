export type FieldScope = "login" | "password" | "profile" | "user";

const SHORT = "A senha precisa ter pelo menos 8 caracteres.";
const LONG = "A senha pode ter no máximo 72 caracteres.";
const GENERIC = "Valor inválido. Revise o campo.";

const MESSAGES: Record<FieldScope, Record<string, Record<string, string>>> = {
  login: {
    email: { REQUIRED: "Informe o e-mail." },
    password: { REQUIRED: "Informe a senha." },
  },
  password: {
    currentPassword: { REQUIRED: "Informe a senha atual.", INCORRECT: "Senha atual incorreta." },
    newPassword: { REQUIRED: "Informe a nova senha.", TOO_SHORT: SHORT, TOO_LONG: LONG, SAME_AS_CURRENT: "A nova senha deve ser diferente da atual." },
    confirmPassword: { REQUIRED: "Confirme a nova senha." },
  },
  profile: {
    name: { REQUIRED: "Informe seu nome.", TOO_LONG: "Use até 60 caracteres." },
  },
  user: {
    name: { REQUIRED: "Informe o nome.", TOO_LONG: "Use até 60 caracteres." },
    email: {
      REQUIRED: "Informe o e-mail.",
      INVALID_FORMAT: "Informe um e-mail válido, como nome@exemplo.com.",
      TOO_LONG: "Use até 254 caracteres.",
      EMAIL_TAKEN: "Este e-mail já está em uso.",
    },
    role: { REQUIRED: "Escolha o nível.", INVALID_VALUE: "Escolha um nível válido.", LAST_ADMIN: "É preciso manter pelo menos um administrador ativo." },
    password: { REQUIRED: "Informe a senha temporária.", TOO_SHORT: SHORT, TOO_LONG: LONG },
  },
};

/** Codigo de erro de campo da API -> mensagem pt-BR do design (3.3, 4.3, 5.3, 6.4). */
export function fieldMessage(scope: FieldScope, field: string, code: string): string {
  return MESSAGES[scope][field]?.[code] ?? GENERIC;
}
