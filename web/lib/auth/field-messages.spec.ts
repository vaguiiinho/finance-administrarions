import { describe, expect, it } from "vitest";
import { fieldMessage, type FieldScope } from "./field-messages";

/** Tabela do design (3.3, 4.3, 5.3, 6.4): codigo de erro de campo da API -> mensagem pt-BR exata. */
const TABLE: [FieldScope, string, string, string][] = [
  ["login", "email", "REQUIRED", "Informe o e-mail."],
  ["login", "password", "REQUIRED", "Informe a senha."],
  ["password", "currentPassword", "REQUIRED", "Informe a senha atual."],
  ["password", "currentPassword", "INCORRECT", "Senha atual incorreta."],
  ["password", "newPassword", "REQUIRED", "Informe a nova senha."],
  ["password", "newPassword", "TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
  ["password", "newPassword", "TOO_LONG", "A senha pode ter no máximo 72 caracteres."],
  ["password", "newPassword", "SAME_AS_CURRENT", "A nova senha deve ser diferente da atual."],
  ["profile", "name", "REQUIRED", "Informe seu nome."],
  ["profile", "name", "TOO_LONG", "Use até 60 caracteres."],
  ["user", "name", "REQUIRED", "Informe o nome."],
  ["user", "name", "TOO_LONG", "Use até 60 caracteres."],
  ["user", "email", "REQUIRED", "Informe o e-mail."],
  ["user", "email", "INVALID_FORMAT", "Informe um e-mail válido, como nome@exemplo.com."],
  ["user", "email", "TOO_LONG", "Use até 254 caracteres."],
  ["user", "email", "EMAIL_TAKEN", "Este e-mail já está em uso."],
  ["user", "role", "REQUIRED", "Escolha o nível."],
  ["user", "role", "INVALID_VALUE", "Escolha um nível válido."],
  ["user", "role", "LAST_ADMIN", "É preciso manter pelo menos um administrador ativo."],
  ["user", "password", "REQUIRED", "Informe a senha temporária."],
  ["user", "password", "TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
  ["user", "password", "TOO_LONG", "A senha pode ter no máximo 72 caracteres."],
];

describe("fieldMessage (microcopy do design)", () => {
  it.each(TABLE)("[%s] %s %s -> %s", (scope, field, code, message) => {
    expect(fieldMessage(scope, field, code)).toBe(message);
  });
  it("codigo desconhecido nao devolve vazio nem o codigo cru", () => {
    const m = fieldMessage("user", "name", "CODIGO_NOVO");
    expect(m.length).toBeGreaterThan(3);
    expect(m).not.toBe("CODIGO_NOVO");
  });
});
