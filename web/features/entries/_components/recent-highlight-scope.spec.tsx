import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { EntryDto } from "@/lib/api/types";
import { EntryDrawerProvider, EntryRow, useEntryDrawer } from "./entry-drawer-context";
import { NewEntryDrawer } from "./new-entry-drawer";

const createEntry = vi.fn();
vi.mock("@/app/(protected)/entries/actions", () => ({ createEntry: (...a: unknown[]) => createEntry(...a) }));
vi.mock("@/app/(protected)/cards/actions", () => ({ createCard: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

function Opener() {
  const { openDrawer } = useEntryDrawer();
  return (
    <>
      <button onClick={openDrawer}>abrir</button>
      <table>
        <tbody>
          <EntryRow id="e1">
            <td>Mercado</td>
          </EntryRow>
        </tbody>
      </table>
    </>
  );
}

const base: EntryDto = {
  id: "e1", type: "EXPENSE", description: "Mercado", category: "Alimentação", date: "2026-10-24", amount: "250.00", paymentMethod: "PIX", card: null, invoice: null,
  referenceMonth: "2026-10", status: "PAID", paidAt: "2026-10-24T13:00:00.000Z", createdAt: "", updatedAt: "",
};

async function createAndWait(tab: "expenses" | "income", response: EntryDto, income = false, params: Record<string, string> = {}) {
  createEntry.mockResolvedValue({ ok: true, data: response });
  const state = parseEntriesSearchParams({ month: "2026-10", tab, d_status: "ALL", ...params }, new Date("2026-10-24T13:00:00.000Z"));
  render(
    <AllProviders>
      <EntryDrawerProvider>
        <Opener />
        <NewEntryDrawer today="2026-10-24" state={state} cards={[]} cardsError={false} categories={["Alimentação"]} />
      </EntryDrawerProvider>
    </AllProviders>,
  );
  await userEvent.click(screen.getByRole("button", { name: "abrir" }));
  const drawer = within(screen.getByRole("dialog", { name: "Novo lançamento" }));
  if (income) await userEvent.click(drawer.getByRole("radio", { name: "Receita" }));
  await userEvent.type(drawer.getByLabelText(/^Descrição/), "Mercado");
  await userEvent.type(drawer.getByLabelText(/^Categoria/), "Alimentação");
  await userEvent.type(drawer.getByLabelText(/^Valor/), "25000");
  await userEvent.click(drawer.getByRole("button", { name: /^Salvar lançamento/ }));
  await waitFor(() => expect(createEntry).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

afterEach(() => createEntry.mockReset());

/** F6 / CAF02: so ha destaque quando o lancamento aparece na tela atual (mes selecionado + tipo da aba ativa). */
describe("destaque so para o que aparece na tela (F6)", () => {
  it("controle: despesa do mes selecionado na aba Despesas e destacada", async () => {
    await createAndWait("expenses", base);
    expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true");
  });

  it("lancamento de OUTRO mes de referencia nao gera destaque (ex.: cartao que cai em novembro)", async () => {
    await createAndWait("expenses", { ...base, paymentMethod: "CARD", referenceMonth: "2026-11", status: "PENDING", paidAt: null });
    expect(screen.getByRole("row", { name: /Mercado/ })).not.toHaveAttribute("data-recent");
  });

  it("receita criada com a aba Despesas ativa nao gera destaque", async () => {
    await createAndWait("expenses", { ...base, type: "INCOME", status: "RECEIVED", paidAt: null }, true);
    expect(screen.getByRole("row", { name: /Mercado/ })).not.toHaveAttribute("data-recent");
  });

  it("despesa criada com a aba Receitas ativa nao gera destaque", async () => {
    await createAndWait("income", base);
    expect(screen.getByRole("row", { name: /Mercado/ })).not.toHaveAttribute("data-recent");
  });

  it("controle: receita do mes na aba Receitas e destacada", async () => {
    await createAndWait("income", { ...base, type: "INCOME", status: "RECEIVED", paidAt: null }, true);
    expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true");
  });

  it("fora dos filtros atuais nao ha destaque (design 3.9.2): despesa paga com filtro d_status=PENDING", async () => {
    await createAndWait("expenses", base, false, { d_status: "PENDING" });
    expect(screen.getByRole("row", { name: /Mercado/ })).not.toHaveAttribute("data-recent");
  });

  it("dentro dos filtros atuais continua destacando (categoria sem diferenciar maiusculas)", async () => {
    await createAndWait("expenses", base, false, { d_category: "alimentação" });
    expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true");
  });

  it("filtro de cartao pix: despesa sem cartao e destacada", async () => {
    await createAndWait("expenses", base, false, { d_card: "pix" });
    expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true");
  });

  it("filtro de cartao pix: despesa de cartao nao e destacada", async () => {
    const card = { id: "0192f8a0-0000-7000-8000-000000000001", name: "Nubank", last4: "1234" } as unknown as EntryDto["card"];
    await createAndWait("expenses", { ...base, paymentMethod: "CARD", card, status: "PENDING", paidAt: null }, false, { d_card: "pix" });
    expect(screen.getByRole("row", { name: /Mercado/ })).not.toHaveAttribute("data-recent");
  });

  it("filtro por cardId: so destaca o lancamento daquele cartao", async () => {
    const id = "0192f8a0-0000-7000-8000-000000000001";
    const card = { id, name: "Nubank", last4: "1234" } as unknown as EntryDto["card"];
    const card2 = { ...card, id: "0192f8a0-0000-7000-8000-000000000002" } as unknown as EntryDto["card"];
    const card_entry = { ...base, paymentMethod: "CARD" as const, status: "PENDING" as const, paidAt: null };
    await createAndWait("expenses", { ...card_entry, card }, false, { d_card: id });
    expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true");
    cleanup();
    await createAndWait("expenses", { ...card_entry, card: card2 }, false, { d_card: id });
    expect(screen.getByRole("row", { name: /Mercado/ })).not.toHaveAttribute("data-recent");
  });
});
