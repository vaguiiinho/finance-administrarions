import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AllProviders, router } from "@/test/helpers/providers";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import { EntryDrawerProvider, useEntryDrawer } from "./entry-drawer-context";
import { NewEntryDrawer } from "./new-entry-drawer";

vi.mock("@/app/(protected)/entries/actions", () => ({ createEntry: vi.fn() }));
vi.mock("@/app/(protected)/cards/actions", () => ({ createCard: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

function Opener() {
  const { openDrawer } = useEntryDrawer();
  return <button onClick={openDrawer}>abrir</button>;
}

/** F1 (design 3.9.2, "foco no primeiro invalido"): o foco programatico na Categoria nao pode cobrir "Informe a categoria.". */
describe("drawer: envio invalido focando a Categoria", () => {
  it("foca a Categoria, mostra o erro e NAO abre a lista de sugestoes por cima dele", async () => {
    const state = parseEntriesSearchParams({ month: "2026-10" }, new Date("2026-10-24T13:00:00.000Z"));
    render(
      <AllProviders>
        <EntryDrawerProvider>
          <Opener />
          <NewEntryDrawer today="2026-10-24" state={state} cards={[]} cardsError={false} categories={["Alimentação", "Moradia"]} />
        </EntryDrawerProvider>
      </AllProviders>,
    );
    await userEvent.click(screen.getByRole("button", { name: "abrir" }));
    const drawer = within(screen.getByRole("dialog", { name: "Novo lançamento" }));
    await userEvent.type(drawer.getByLabelText(/^Descrição/), "Mercado");
    await userEvent.type(drawer.getByLabelText(/^Valor/), "25000");
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    const category = drawer.getByRole("combobox", { name: /^Categoria/ });
    await waitFor(() => expect(category).toHaveFocus());
    expect(drawer.getByText("Informe a categoria.")).toBeVisible();
    expect(category).toHaveAttribute("aria-expanded", "false");
    expect(drawer.queryAllByRole("option")).toHaveLength(0);
  });
});
