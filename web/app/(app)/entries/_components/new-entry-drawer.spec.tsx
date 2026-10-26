import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { CardDto, EntryDto } from "@/lib/api/types";
import { EntryDrawerProvider, useEntryDrawer } from "./entry-drawer-context";
import { NewEntryDrawer } from "./new-entry-drawer";

const createEntry = vi.fn();
const createCard = vi.fn();
vi.mock("../actions", () => ({ createEntry: (...args: unknown[]) => createEntry(...args) }));
vi.mock("../../cards/actions", () => ({ createCard: (...args: unknown[]) => createCard(...args) }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const NOW = new Date("2026-10-24T13:00:00.000Z");
const TODAY = "2026-10-24";
const NUBANK: CardDto = { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank", closingDay: 25, dueDay: 5, createdAt: "", updatedAt: "" };

const created = (over: Partial<EntryDto> = {}): EntryDto => ({
  id: "e1",
  type: "EXPENSE",
  description: "Mercado",
  category: "Alimentação",
  date: TODAY,
  amount: "250.00",
  paymentMethod: "PIX",
  card: null,
  invoice: null,
  referenceMonth: "2026-10",
  status: "PAID",
  paidAt: "2026-10-24T13:00:00.000Z",
  createdAt: "",
  updatedAt: "",
  ...over,
});

function OpenOnMount() {
  const { openDrawer } = useEntryDrawer();
  return <button onClick={openDrawer}>abrir</button>;
}

async function setup(props: { cards?: CardDto[]; cardsError?: boolean; month?: string } = {}) {
  const state = parseEntriesSearchParams({ month: props.month ?? "2026-10" }, NOW);
  render(
    <AllProviders>
      <EntryDrawerProvider>
        <OpenOnMount />
        <NewEntryDrawer today={TODAY} state={state} cards={props.cards ?? [NUBANK]} cardsError={props.cardsError ?? false} categories={["Alimentação", "Moradia"]} />
      </EntryDrawerProvider>
    </AllProviders>,
  );
  await userEvent.click(screen.getByRole("button", { name: "abrir" }));
  return within(screen.getByRole("dialog", { name: "Novo lançamento" }));
}

async function fillBasics(drawer: ReturnType<typeof within>, amount = "250,00") {
  await userEvent.type(drawer.getByLabelText(/^Descrição/), "Mercado");
  await userEvent.type(drawer.getByLabelText(/^Categoria/), "Alimentação");
  await userEvent.type(drawer.getByLabelText(/^Valor/), amount.replace(/\D/g, ""));
}

beforeEach(() => {
  createEntry.mockReset();
  createCard.mockReset();
  router.refresh.mockClear();
});

describe("Drawer 'Novo lançamento' - payload (ADR 9.4, P31, B8)", () => {
  it("padrao Despesa + PIX: campo `paid` e OMITIDO (nunca true) e o valor segue como string decimal", async () => {
    createEntry.mockResolvedValue({ ok: true, data: created() });
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1));
    const payload = createEntry.mock.calls[0][0];
    expect(payload).toEqual({ type: "EXPENSE", description: "Mercado", category: "Alimentação", date: TODAY, amount: "250.00", paymentMethod: "PIX" });
    expect("paid" in payload).toBe(false);
  });

  it("'Ainda nao paguei' marcado envia paid: false", async () => {
    createEntry.mockResolvedValue({ ok: true, data: created({ status: "PENDING", paidAt: null }) });
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("checkbox", { name: "Ainda não paguei" }));
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(createEntry).toHaveBeenCalled());
    expect(createEntry.mock.calls[0][0].paid).toBe(false);
  });

  it("B8: data futura NAO muda o envio (sem paid), apenas mostra o aviso nao bloqueante", async () => {
    createEntry.mockResolvedValue({ ok: true, data: created() });
    const drawer = await setup();
    await fillBasics(drawer);
    const date = drawer.getByLabelText(/^Data/);
    await userEvent.clear(date);
    await userEvent.type(date, "2026-12-31");
    expect(drawer.getByText(/Data futura: ela será registrada como paga hoje/)).toBeInTheDocument();
    expect(drawer.getByRole("checkbox", { name: "Ainda não paguei" })).not.toBeChecked();
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(createEntry).toHaveBeenCalled());
    expect("paid" in createEntry.mock.calls[0][0]).toBe(false);
  });

  it("Despesa + Cartao: envia cardId e nunca paid; 'Ainda nao paguei' fica OCULTO (D23) com a linha de status inicial (CA73)", async () => {
    createEntry.mockResolvedValue({ ok: true, data: created({ paymentMethod: "CARD", status: "PENDING" }) });
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("checkbox", { name: "Ainda não paguei" })); // guarda o valor para voltar a PIX
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    expect(drawer.queryByRole("checkbox", { name: "Ainda não paguei" })).not.toBeInTheDocument();
    expect(drawer.getByText("Status inicial: pendente, na fatura do cartão.")).toBeInTheDocument();
    await userEvent.selectOptions(drawer.getByLabelText(/^Cartão/), NUBANK.id);
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(createEntry).toHaveBeenCalled());
    const payload = createEntry.mock.calls[0][0];
    expect(payload).toMatchObject({ paymentMethod: "CARD", cardId: NUBANK.id });
    expect("paid" in payload).toBe(false);
  });

  it("Receita: forma fixa em PIX (Cartao desabilitado), sem cardId e sem paid mesmo com escolhas anteriores guardadas", async () => {
    createEntry.mockResolvedValue({ ok: true, data: created({ type: "INCOME", status: "RECEIVED", paidAt: null }) });
    const drawer = await setup();
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.selectOptions(drawer.getByLabelText(/^Cartão/), NUBANK.id);
    await userEvent.click(drawer.getByRole("radio", { name: "Receita" }));
    expect(drawer.getByRole("radio", { name: "PIX" })).toBeChecked();
    expect(drawer.getByRole("radio", { name: "Cartão" })).toHaveAttribute("aria-disabled", "true");
    expect(drawer.getByText("Receitas são sempre via PIX.")).toBeInTheDocument();
    expect(drawer.queryByRole("checkbox", { name: "Ainda não paguei" })).not.toBeInTheDocument();
    expect(drawer.getByText("Status inicial: recebida.")).toBeInTheDocument();
    await fillBasics(drawer, "5000,00");
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(createEntry).toHaveBeenCalled());
    const payload = createEntry.mock.calls[0][0];
    expect(payload).toMatchObject({ type: "INCOME", paymentMethod: "PIX", amount: "5000.00" });
    expect("cardId" in payload).toBe(false);
    expect("paid" in payload).toBe(false);
  });

  it("voltar a Despesa restaura as escolhas guardadas (Cartao + cartao selecionado)", async () => {
    const drawer = await setup();
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.selectOptions(drawer.getByLabelText(/^Cartão/), NUBANK.id);
    await userEvent.click(drawer.getByRole("radio", { name: "Receita" }));
    await userEvent.click(drawer.getByRole("radio", { name: "Despesa" }));
    expect(drawer.getByRole("radio", { name: "Cartão" })).toBeChecked();
    expect(drawer.getByLabelText(/^Cartão/)).toHaveValue(NUBANK.id);
  });
});

describe("Drawer - validacao, erros e sucesso", () => {
  it("envio vazio mantem o drawer aberto, mostra erros inline e nao chama a API (CA74)", async () => {
    const drawer = await setup();
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    expect(createEntry).not.toHaveBeenCalled();
    expect(drawer.getByText("Informe a descrição.")).toBeInTheDocument();
    expect(drawer.getByText("Informe a categoria.")).toBeInTheDocument();
    expect(drawer.getByText("Informe um valor maior que zero.")).toBeInTheDocument();
    expect(drawer.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    expect(drawer.getByLabelText(/^Descrição/)).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("400 da API e mapeado para o campo", async () => {
    createEntry.mockResolvedValue({
      ok: false,
      error: { status: 400, code: "VALIDATION_ERROR", message: "Dados inválidos.", fields: [{ field: "amount", code: "TOO_LARGE", message: "Valor acima do máximo." }] },
    });
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    expect(await drawer.findByText("Valor acima do máximo.")).toBeInTheDocument();
  });

  it("erro de rede/500 mostra banner e preserva os dados digitados", async () => {
    createEntry.mockResolvedValue({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    expect(await drawer.findByText(/Não foi possível salvar o lançamento/)).toBeInTheDocument();
    expect(drawer.getByLabelText(/^Descrição/)).toHaveValue("Mercado");
  });

  it("sucesso fecha o drawer e mostra o toast com os dados da RESPOSTA (cartao: fatura nov/26, vencimento 05/11/2026)", async () => {
    createEntry.mockResolvedValue({
      ok: true,
      data: created({ paymentMethod: "CARD", card: { id: NUBANK.id, name: "Nubank" }, invoice: { closingDate: "2026-10-25", dueDate: "2026-11-05" }, referenceMonth: "2026-11", status: "PENDING", paidAt: null }),
    });
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.selectOptions(drawer.getByLabelText(/^Cartão/), NUBANK.id);
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const toast = await screen.findByText(/Lançamento criado na fatura de nov\/26 do Nubank, vence 05\/11\/2026\./);
    expect(toast).toHaveTextContent("Ela está em novembro de 2026.");
    expect(screen.getByRole("link", { name: "Ver novembro" })).toHaveAttribute("href", "/entries?month=2026-11");
  });
});

describe("Drawer - atalho '+ Novo cartão' embutido (D22, CA75)", () => {
  it("abre o painel, desabilita o select e o Salvar, e preserva os dados do lancamento", async () => {
    const drawer = await setup();
    await userEvent.type(drawer.getByLabelText(/^Descrição/), "Compra teste");
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    const trigger = drawer.getByRole("button", { name: "+ Novo cartão" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(drawer.getByRole("group", { name: "Novo cartão" })).toBeInTheDocument();
    expect(drawer.getByLabelText(/^Nome do cartão/)).toHaveFocus();
    expect(drawer.getByLabelText(/^Cartão/)).toBeDisabled();
    expect(drawer.getByRole("button", { name: "Salvar lançamento" })).toHaveAttribute("aria-disabled", "true");
    expect(drawer.getByText("Conclua ou cancele o novo cartão")).toBeInTheDocument();
    expect(drawer.getByLabelText(/^Descrição/)).toHaveValue("Compra teste");
  });

  it("criar com sucesso seleciona o novo cartao, foca o select e mostra a confirmacao inline", async () => {
    const inter: CardDto = { id: "0192f1e2-0000-7000-8000-000000000009", name: "Inter", closingDay: 3, dueDay: 10, createdAt: "", updatedAt: "" };
    createCard.mockResolvedValue({ ok: true, data: inter });
    const drawer = await setup();
    await userEvent.type(drawer.getByLabelText(/^Descrição/), "Compra teste");
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.click(drawer.getByRole("button", { name: "+ Novo cartão" }));
    await userEvent.type(drawer.getByLabelText(/^Nome do cartão/), "Inter");
    await userEvent.type(drawer.getByLabelText(/^Dia de fechamento/), "3");
    await userEvent.type(drawer.getByLabelText(/^Dia de vencimento/), "10");
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(createCard).toHaveBeenCalledWith({ name: "Inter", closingDay: 3, dueDay: 10 });
    const select = await drawer.findByLabelText(/^Cartão/);
    await waitFor(() => expect(select).toHaveValue(inter.id));
    await waitFor(() => expect(select).toHaveFocus());
    expect(drawer.getByRole("status")).toHaveTextContent('Cartão "Inter" criado e selecionado.');
    expect(drawer.queryByRole("group", { name: "Novo cartão" })).not.toBeInTheDocument();
    expect(drawer.getByLabelText(/^Descrição/)).toHaveValue("Compra teste");
    expect(drawer.getByRole("button", { name: "Salvar lançamento" })).not.toHaveAttribute("aria-disabled");
  });

  it("409 mostra o erro inline no nome, mantem o painel aberto e o foco no nome", async () => {
    createCard.mockResolvedValue({ ok: false, error: { status: 409, code: "CARD_NAME_TAKEN", message: "x" } });
    const drawer = await setup();
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.click(drawer.getByRole("button", { name: "+ Novo cartão" }));
    await userEvent.type(drawer.getByLabelText(/^Nome do cartão/), "Nubank");
    await userEvent.type(drawer.getByLabelText(/^Dia de fechamento/), "3");
    await userEvent.type(drawer.getByLabelText(/^Dia de vencimento/), "10");
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(await drawer.findByText("Já existe um cartão com esse nome.")).toBeInTheDocument();
    expect(drawer.getByRole("group", { name: "Novo cartão" })).toBeInTheDocument();
    expect(drawer.getByLabelText(/^Nome do cartão/)).toHaveFocus();
  });

  it("Enter no painel envia SO o painel (nao o lancamento) e Esc fecha so o painel", async () => {
    createCard.mockResolvedValue({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
    const drawer = await setup();
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.click(drawer.getByRole("button", { name: "+ Novo cartão" }));
    await userEvent.type(drawer.getByLabelText(/^Nome do cartão/), "Inter{Enter}");
    expect(createEntry).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(drawer.queryByRole("group", { name: "Novo cartão" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(drawer.getByLabelText(/^Cartão/)).toHaveFocus());
  });

  it("sem cartoes: 'Nenhum cartão cadastrado.' + botao '+ Novo cartão' (segmento Cartao continua habilitado)", async () => {
    const drawer = await setup({ cards: [] });
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    expect(drawer.getByText("Nenhum cartão cadastrado.")).toBeInTheDocument();
    expect(drawer.getAllByRole("button", { name: "+ Novo cartão" })).toHaveLength(1);
    expect(drawer.queryByRole("combobox", { name: /Cartão/ })).not.toBeInTheDocument();
  });

  it("erro ao listar cartoes: mensagem e 'Tentar novamente' (refaz a pagina)", async () => {
    const drawer = await setup({ cards: [], cardsError: true });
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    expect(drawer.getByText("Não foi possível carregar os cartões.")).toBeInTheDocument();
    await userEvent.click(drawer.getByRole("button", { name: "Tentar novamente" }));
    expect(router.refresh).toHaveBeenCalled();
    expect(drawer.getByRole("button", { name: "+ Novo cartão" })).toBeInTheDocument();
  });
});

describe("Drawer - Server Action que rejeita", () => {
  it("criar lancamento: banner generico, dados preservados e botao volta a funcionar", async () => {
    createEntry.mockRejectedValue(new Error("rede"));
    const drawer = await setup();
    await fillBasics(drawer);
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    expect(await drawer.findByText(/Não foi possível salvar o lançamento/)).toBeInTheDocument();
    expect(drawer.getByRole("button", { name: "Salvar lançamento" })).not.toHaveAttribute("aria-busy");
    expect(drawer.getByLabelText(/^Descrição/)).toHaveValue("Mercado");
  });
  it("criar cartao no painel embutido: banner generico e painel continua utilizavel", async () => {
    createCard.mockRejectedValue(new Error("rede"));
    const drawer = await setup();
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.click(drawer.getByRole("button", { name: "+ Novo cartão" }));
    await userEvent.type(drawer.getByLabelText(/^Nome do cartão/), "Inter");
    await userEvent.type(drawer.getByLabelText(/^Dia de fechamento/), "3");
    await userEvent.type(drawer.getByLabelText(/^Dia de vencimento/), "10");
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(await drawer.findByText("Não foi possível criar o cartão. Tente novamente.")).toBeInTheDocument();
    expect(drawer.getByRole("button", { name: "Criar cartão" })).not.toHaveAttribute("aria-busy");
    expect(drawer.getByLabelText(/^Nome do cartão/)).toHaveValue("Inter");
  });
});
