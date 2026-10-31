import { describe, expect, it } from "vitest";
import { focusTargetAfterPay } from "./focus-target";

/** ADR 0007 7.5: a decisao vem do FILTRO, nao da existencia do ref (a revalidacao pode ja ter desmontado o bloco). */
describe("focusTargetAfterPay (RF21, RF24, CA55, CA56)", () => {
  it("Todos mantem o bloco na lista: foco no titulo do bloco", () => {
    expect(focusTargetAfterPay("ALL")).toBe("block");
  });

  it("Pendente tira o bloco/linha paga da lista: foco no h2 do painel", () => {
    expect(focusTargetAfterPay("PENDING")).toBe("panel");
  });

  it("Pago: foco no h2 do painel (dado obsoleto), nunca num bloco que pode nao existir", () => {
    expect(focusTargetAfterPay("PAID")).toBe("panel");
  });
});
