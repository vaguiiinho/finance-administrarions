import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import type { CardDto } from "@/lib/api/types";

const createCard = vi.fn();
const updateCard = vi.fn();
vi.mock("@/app/(protected)/cards/actions", () => ({ createCard: (...a: unknown[]) => createCard(...a), updateCard: (...a: unknown[]) => updateCard(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/cards" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, ...rest }: { children: ReactNode; href: string; scroll?: boolean } & Record<string, unknown>) => (void scroll, (<a href={href} {...rest}>{children}</a>)) }));

import { CardDrawerProvider, NewCardButton } from "./card-drawer";
import { CardsList } from "./cards-list";
import { CardsSkeleton } from "./cards-states";

const NUBANK: CardDto = { id: "0192f1e2-0000-7000-8000-000000000001", name: "Nubank", closingDay: 25, dueDay: 5, createdAt: "", updatedAt: "" };

const setup = () =>
  render(
    <AllProviders>
      <CardDrawerProvider>
        <NewCardButton />
        <CardsList cards={[NUBANK]} currentMonth="2026-10" />
      </CardDrawerProvider>
    </AllProviders>,
  );

async function fill(drawer: ReturnType<typeof within>, name: string, closing: string, due: string) {
  const nameInput = drawer.getByLabelText(/^Nome do cartão/);
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, name);
  const c = drawer.getByLabelText(/^Dia de fechamento/);
  await userEvent.clear(c);
  await userEvent.type(c, closing);
  const d = drawer.getByLabelText(/^Dia de vencimento/);
  await userEvent.clear(d);
  await userEvent.type(d, due);
}

beforeEach(() => {
  createCard.mockReset();
  updateCard.mockReset();
});

describe("CardsList (CA77, DR8)", () => {
  it("texto acessivel 'Nubank · Fecha dia 25 · Vence dia 5' e atalho para despesas do mes atual filtradas pelo cartao", () => {
    setup();
    expect(screen.getByText("Nubank · Fecha dia 25 · Vence dia 5")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Ver despesas de Nubank em outubro de 2026" });
    expect(link).toHaveAttribute("href", `/entries?month=2026-10&d_card=${NUBANK.id}`);
    expect(screen.getByRole("button", { name: "Editar Nubank" })).toBeInTheDocument();
  });
  it("skeleton anuncia carregamento", () => {
    render(<CardsSkeleton />);
    expect(screen.getByText("Carregando cartões")).toBeInTheDocument();
  });
});

describe("CardDrawer", () => {
  it("criar: valida, envia inteiros, fecha e mostra toast", async () => {
    createCard.mockResolvedValue({ ok: true, data: { ...NUBANK, name: "Inter" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    const drawer = within(screen.getByRole("dialog", { name: "Novo cartão" }));
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(createCard).not.toHaveBeenCalled();
    expect(drawer.getByText("Informe o nome.")).toBeInTheDocument();
    await fill(drawer, "Inter", "3", "10");
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(createCard).toHaveBeenCalledWith({ name: "Inter", closingDay: 3, dueDay: 10 });
    expect(await screen.findByText('Cartão "Inter" criado.')).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("409 inline no nome; 400 por campo; 500 com banner e dados preservados", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    const drawer = within(screen.getByRole("dialog"));
    await fill(drawer, "Nubank", "3", "10");
    createCard.mockResolvedValueOnce({ ok: false, error: { status: 409, code: "CARD_NAME_TAKEN", message: "x" } });
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(await drawer.findByText("Já existe um cartão com esse nome.")).toBeInTheDocument();
    createCard.mockResolvedValueOnce({ ok: false, error: { status: 400, code: "VALIDATION_ERROR", message: "x", fields: [{ field: "dueDay", code: "OUT_OF_RANGE", message: "Dia fora do intervalo." }] } });
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(await drawer.findByText("Dia fora do intervalo.")).toBeInTheDocument();
    createCard.mockResolvedValueOnce({ ok: false, error: { status: 500, code: "INTERNAL_ERROR", message: "x" } });
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(await drawer.findByText(/Não foi possível salvar o cartão/)).toBeInTheDocument();
    expect(drawer.getByLabelText(/^Nome do cartão/)).toHaveValue("Nubank");
  });

  it("editar: aviso de nao retroatividade, 'Nenhuma alteração.' sem mudanca e update com mudanca", async () => {
    updateCard.mockResolvedValue({ ok: true, data: { ...NUBANK, name: "Nubank Ultravioleta" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Nubank" }));
    const drawer = within(screen.getByRole("dialog", { name: "Editar cartão" }));
    expect(drawer.getByText(/Alterações valem só para novos lançamentos/)).toBeInTheDocument();
    expect(drawer.getByLabelText(/^Nome do cartão/)).toHaveValue("Nubank");
    await userEvent.click(drawer.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Nenhuma alteração.")).toBeInTheDocument();
    expect(updateCard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Editar Nubank" }));
    const again = within(screen.getByRole("dialog"));
    await userEvent.type(again.getByLabelText(/^Nome do cartão/), " Ultravioleta");
    await userEvent.click(again.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateCard).toHaveBeenCalledWith(NUBANK.id, { name: "Nubank Ultravioleta", closingDay: 25, dueDay: 5 }));
    expect(await screen.findByText('Cartão "Nubank Ultravioleta" atualizado.')).toBeInTheDocument();
  });

  it("404 na edicao mostra 'Este cartão não existe mais.'", async () => {
    updateCard.mockResolvedValue({ ok: false, error: { status: 404, code: "CARD_NOT_FOUND", message: "x" } });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Nubank" }));
    const drawer = within(screen.getByRole("dialog"));
    await userEvent.type(drawer.getByLabelText(/^Nome do cartão/), "2");
    await userEvent.click(drawer.getByRole("button", { name: "Salvar alterações" }));
    expect(await drawer.findByText("Este cartão não existe mais.")).toBeInTheDocument();
  });

  it("Cancelar fecha sem chamar a API", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createCard).not.toHaveBeenCalled();
  });
});

describe("CardDrawer - Server Action que rejeita", () => {
  it("banner generico, dados preservados e botao volta ao normal", async () => {
    createCard.mockRejectedValue(new Error("rede"));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    const drawer = within(screen.getByRole("dialog"));
    await fill(drawer, "Inter", "3", "10");
    await userEvent.click(drawer.getByRole("button", { name: "Criar cartão" }));
    expect(await drawer.findByText(/Não foi possível salvar o cartão/)).toBeInTheDocument();
    expect(drawer.getByRole("button", { name: "Criar cartão" })).not.toHaveAttribute("aria-busy");
    expect(drawer.getByLabelText(/^Nome do cartão/)).toHaveValue("Inter");
  });
});
