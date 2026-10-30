import { fireEvent } from "@testing-library/react";

/**
 * jsdom nao traduz a tecla Esc em evento `cancel` do <dialog> (o navegador faz). O `ModalDialog` trata o `cancel`;
 * os testes disparam o mesmo evento. Devolucao de foco ao gatilho depende do <dialog> nativo: so no Playwright.
 */
export function pressEscapeInDialog() {
  const dialog = document.querySelector("dialog[open]");
  if (!dialog) throw new Error("nenhum <dialog> aberto");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
}
