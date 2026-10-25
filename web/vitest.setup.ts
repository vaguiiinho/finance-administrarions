import "@testing-library/jest-dom/vitest";

// jsdom nao implementa <dialog>.showModal()/close(): polyfill minimo para os testes de componente (drawer, modais).
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
