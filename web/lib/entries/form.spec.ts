import { describe, expect, it } from "vitest";
import {
  buildCardPayload,
  buildCreateEntryPayload,
  initialEntryForm,
  initialStatusText,
  mapApiFieldIssues,
  mapCardFieldIssues,
  validateCardForm,
  validateEntryForm,
  type EntryFormValues,
} from "./form";

const base = (over: Partial<EntryFormValues> = {}): EntryFormValues => ({
  ...initialEntryForm("2026-10-24"),
  description: "  Mercado  ",
  category: " Alimentação ",
  amount: "1.234,56",
  ...over,
});
const CARD_ID = "0192f1e2-0000-7000-8000-000000000001";

describe("buildCreateEntryPayload - P31 / B8 (ADR 9.4)", () => {
  it("padrao (Despesa + PIX, 'Ainda nao paguei' desmarcado): campo `paid` OMITIDO, nunca true", () => {
    const payload = buildCreateEntryPayload(base());
    expect(payload).toEqual({ type: "EXPENSE", description: "Mercado", category: "Alimentação", date: "2026-10-24", amount: "1234.56", paymentMethod: "PIX" });
    expect("paid" in payload).toBe(false);
    expect("cardId" in payload).toBe(false);
  });

  it("Despesa + PIX + 'Ainda nao paguei': paid === false", () => {
    expect(buildCreateEntryPayload(base({ notPaid: true })).paid).toBe(false);
  });

  it("Despesa + Cartao: envia cardId e NUNCA paid, mesmo com 'Ainda nao paguei' guardado", () => {
    const payload = buildCreateEntryPayload(base({ paymentMethod: "CARD", cardId: CARD_ID, notPaid: true }));
    expect(payload.cardId).toBe(CARD_ID);
    expect(payload.paymentMethod).toBe("CARD");
    expect("paid" in payload).toBe(false);
  });

  it("Receita: forma PIX, sem cardId e sem paid, mesmo com cartao e flag guardados (CA73)", () => {
    const payload = buildCreateEntryPayload(base({ type: "INCOME", paymentMethod: "CARD", cardId: CARD_ID, notPaid: true }));
    expect(payload.paymentMethod).toBe("PIX");
    expect("cardId" in payload).toBe(false);
    expect("paid" in payload).toBe(false);
  });

  it("alternar Despesa -> Receita -> Despesa restaura as escolhas (o formulario so deriva o payload)", () => {
    const form = base({ paymentMethod: "CARD", cardId: CARD_ID });
    expect(buildCreateEntryPayload({ ...form, type: "INCOME" }).paymentMethod).toBe("PIX");
    expect(buildCreateEntryPayload({ ...form, type: "EXPENSE" }).cardId).toBe(CARD_ID);
  });

  it("B8: data futura NAO altera o envio (nasce paga, sem paid)", () => {
    const payload = buildCreateEntryPayload(base({ date: "2030-01-01" }));
    expect("paid" in payload).toBe(false);
  });

  it("nunca envia status, referenceMonth, invoice ou datas de fatura (P24)", () => {
    const keys = Object.keys(buildCreateEntryPayload(base({ paymentMethod: "CARD", cardId: CARD_ID })));
    for (const forbidden of ["status", "referenceMonth", "invoice", "closingDate", "dueDate"]) expect(keys).not.toContain(forbidden);
  });

  it("o valor segue como string decimal (nunca Number)", () => {
    expect(typeof buildCreateEntryPayload(base({ amount: "0,05" })).amount).toBe("string");
    expect(buildCreateEntryPayload(base({ amount: "0,05" })).amount).toBe("0.05");
  });
});

describe("initialStatusText (D23)", () => {
  it.each([
    [{}, "Status inicial: paga."],
    [{ notPaid: true }, "Status inicial: pendente. Você poderá marcá-la como paga depois."],
    [{ paymentMethod: "CARD" as const }, "Status inicial: pendente, na fatura do cartão."],
    [{ type: "INCOME" as const }, "Status inicial: recebida."],
  ])("%j -> %s", (over, expected) => {
    expect(initialStatusText(base(over))).toBe(expected);
  });
});

describe("validateEntryForm (mensagens do design 3.9.1)", () => {
  it("formulario valido nao tem erros", () => {
    expect(validateEntryForm(base())).toEqual({});
  });

  it("vazio reporta todas as violacoes juntas (CA19)", () => {
    const errors = validateEntryForm(initialEntryForm("2026-10-24"));
    expect(errors).toEqual({ description: "Informe a descrição.", category: "Informe a categoria.", amount: "Informe um valor maior que zero." });
  });

  it("limites de tamanho depois do trim", () => {
    expect(validateEntryForm(base({ description: "a".repeat(121) })).description).toBe("A descrição deve ter no máximo 120 caracteres.");
    expect(validateEntryForm(base({ description: "a".repeat(120) })).description).toBeUndefined();
    expect(validateEntryForm(base({ category: "c".repeat(51) })).category).toBe("A categoria deve ter no máximo 50 caracteres.");
  });

  it("data civil invalida e rejeitada (29/02 em ano nao bissexto)", () => {
    expect(validateEntryForm(base({ date: "2026-02-29" })).date).toBe("Informe uma data válida.");
    expect(validateEntryForm(base({ date: "" })).date).toBe("Informe uma data válida.");
    expect(validateEntryForm(base({ date: "2028-02-29" })).date).toBeUndefined();
  });

  it("valor zero, invalido e acima do maximo", () => {
    expect(validateEntryForm(base({ amount: "0,00" })).amount).toBe("Informe um valor maior que zero.");
    expect(validateEntryForm(base({ amount: "abc" })).amount).toBe("Informe um valor maior que zero.");
    expect(validateEntryForm(base({ amount: "10.000.000.000,00" })).amount).toBe("O valor máximo é R$ 9.999.999.999,99.");
    expect(validateEntryForm(base({ amount: "9.999.999.999,99" })).amount).toBeUndefined();
  });

  it("cartao obrigatorio so com Despesa + Cartao", () => {
    expect(validateEntryForm(base({ paymentMethod: "CARD" })).cardId).toBe("Escolha o cartão.");
    expect(validateEntryForm(base({ type: "INCOME", paymentMethod: "CARD" })).cardId).toBeUndefined();
    expect(validateEntryForm(base({ paymentMethod: "CARD", cardId: CARD_ID })).cardId).toBeUndefined();
  });
});

describe("mapApiFieldIssues (400 por campo)", () => {
  it("mapeia campos conhecidos e manda o resto para o resumo", () => {
    const { fields, unmapped } = mapApiFieldIssues([
      { field: "amount", code: "MUST_BE_POSITIVE", message: "Valor deve ser maior que zero." },
      { field: "paid", code: "NOT_ALLOWED_FOR_CARD", message: "Despesa no cartão sempre nasce pendente." },
      { field: "algo", code: "X", message: "Outro erro." },
    ]);
    expect(fields).toEqual({ amount: "Valor deve ser maior que zero.", paymentMethod: "Despesa no cartão sempre nasce pendente." });
    expect(unmapped).toEqual(["Outro erro."]);
  });
  it("aceita ausencia de detalhes", () => {
    expect(mapApiFieldIssues(undefined)).toEqual({ fields: {}, unmapped: [] });
  });
});

describe("cartao (painel embutido e /cards) - RF01", () => {
  it("valida nome 1-50 e dias 1-31", () => {
    expect(validateCardForm({ name: "Inter", closingDay: "3", dueDay: "10" })).toEqual({});
    expect(validateCardForm({ name: " ", closingDay: "0", dueDay: "32" })).toEqual({
      name: "Informe o nome.",
      closingDay: "Informe um dia entre 1 e 31.",
      dueDay: "Informe um dia entre 1 e 31.",
    });
    expect(validateCardForm({ name: "n".repeat(51), closingDay: "x", dueDay: "1.5" }).name).toBe("O nome deve ter no máximo 50 caracteres.");
  });
  it("monta o payload com inteiros", () => {
    expect(buildCardPayload({ name: " Inter ", closingDay: "03", dueDay: "10" })).toEqual({ name: "Inter", closingDay: 3, dueDay: 10 });
  });
  it("mapeia 400/409 por campo", () => {
    const { fields, unmapped } = mapCardFieldIssues([
      { field: "name", code: "NAME_TAKEN", message: "Já existe um cartão com esse nome." },
      { field: "x", code: "Y", message: "z" },
    ]);
    expect(fields.name).toBe("Já existe um cartão com esse nome.");
    expect(unmapped).toEqual(["z"]);
  });
});
