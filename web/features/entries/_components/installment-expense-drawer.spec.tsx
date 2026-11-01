import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { CardDto } from "@/lib/api/types";
import { EntryDrawerProvider, useEntryDrawer } from "./entry-drawer-context";
import { InstallmentExpenseDrawer } from "./installment-expense-drawer";

const createInstallmentExpenses = vi.hoisted(() => vi.fn());
vi.mock("@/app/(protected)/entries/actions", () => ({ createInstallmentExpenses }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const TODAY = "2026-10-24";
const CARD: CardDto = { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank", closingDay: 25, dueDay: 5, createdAt: "", updatedAt: "" };

function OpenInstallments() {
  const { openInstallmentsDrawer } = useEntryDrawer();
  return <button onClick={openInstallmentsDrawer}>abrir parcelas</button>;
}

async function setup(props: { cards?: CardDto[] } = {}) {
  render(
    <AllProviders>
      <EntryDrawerProvider>
        <OpenInstallments />
        <InstallmentExpenseDrawer today={TODAY} cards={props.cards ?? [CARD]} cardsError={false} categories={["Mercado"]} />
      </EntryDrawerProvider>
    </AllProviders>,
  );
  await userEvent.click(screen.getByRole("button", { name: "abrir parcelas" }));
  return within(screen.getByRole("dialog", { name: "Nova despesa parcelada" }));
}

beforeEach(() => {
  createInstallmentExpenses.mockReset();
  router.refresh.mockClear();
});

describe("Drawer de despesa parcelada", () => {
  it("mostra a prévia com a divisão dos centavos e cria somente despesas", async () => {
    createInstallmentExpenses.mockResolvedValue({ ok: true, data: Array.from({ length: 6 }, (_, index) => ({ id: `entry-${index}` })) });
    const drawer = await setup();
    await userEvent.type(drawer.getByLabelText(/^Descrição/), "Notebook");
    await userEvent.type(drawer.getByLabelText(/^Categoria/), "Mercado");
    await userEvent.type(drawer.getByLabelText(/^Valor total/), "35000");

    expect(drawer.getByRole("region", { name: "Prévia das parcelas" })).toHaveTextContent("58,34");
    expect(drawer.getByRole("radio", { name: "PIX" })).toBeChecked();
    expect(drawer.queryByRole("radio", { name: "Receita" })).not.toBeInTheDocument();

    await userEvent.click(drawer.getByRole("button", { name: "Criar parcelas (6)" }));
    await waitFor(() => expect(createInstallmentExpenses).toHaveBeenCalledWith({
      description: "Notebook",
      category: "Mercado",
      date: TODAY,
      amount: "350.00",
      installments: 6,
      paymentMethod: "PIX",
    }));
    expect(await screen.findByText("6 parcelas criadas.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explica cartão obrigatório quando não há cartões e oferece cadastro", async () => {
    const drawer = await setup({ cards: [] });
    await userEvent.click(drawer.getByRole("radio", { name: "Cartão" }));
    await userEvent.click(drawer.getByRole("button", { name: "Criar parcelas (6)" }));

    expect(drawer.getByText("Escolha o cartão.")).toBeInTheDocument();
    await userEvent.click(drawer.getByRole("button", { name: "+ Novo cartão" }));
    expect(router.push).toHaveBeenCalledWith("/cards");
  });
});
