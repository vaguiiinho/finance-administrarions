import type { ActionError } from "@/lib/api/types";
import { fieldMessage } from "@/lib/auth/field-messages";

export const NETWORK_TEXT = "Não foi possível salvar agora. Verifique sua conexão e tente novamente.";
export const USER_NOT_FOUND_TEXT = "Usuário não encontrado. A lista foi atualizada.";
export const FORBIDDEN_TEXT = "Você não tem permissão para esta ação.";
export const CANNOT_TARGET_SELF_TEXT = "Você não pode executar esta ação na sua própria conta.";

/** Texto de erro das acoes de gestao de usuarios, por codigo (design 6.9, 14): codigo desconhecido usa a `message` da API. */
export function userActionErrorText(error: ActionError): string {
  switch (error.code) {
    case "USER_NOT_FOUND":
      return USER_NOT_FOUND_TEXT;
    case "FORBIDDEN":
      return FORBIDDEN_TEXT;
    case "LAST_ADMIN":
      return fieldMessage("user", "role", "LAST_ADMIN");
    case "CANNOT_TARGET_SELF":
      return CANNOT_TARGET_SELF_TEXT;
    case "NETWORK_ERROR":
      return NETWORK_TEXT;
    default:
      return error.status === 0 ? NETWORK_TEXT : error.message;
  }
}

/** Erros que tiram a pessoa do contexto da lista: ela e recarregada (e, sem permissao, a pagina vira not-found). */
export const staleListCodes: ReadonlySet<string> = new Set(["USER_NOT_FOUND", "FORBIDDEN"]);
