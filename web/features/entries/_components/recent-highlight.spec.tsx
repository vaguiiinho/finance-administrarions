import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNav } from "@/components/navigation";
import { AllProviders, router } from "@/test/helpers/providers";
import { parseEntriesSearchParams } from "@/lib/filters/entries-search-params";
import type { EntryDto } from "@/lib/api/types";
import { EntryDrawerProvider, EntryItem, EntryRow, RECENT_HIGHLIGHT_MS, RecentBadge, useEntryDrawer } from "./entry-drawer-context";
import { NewEntryDrawer } from "./new-entry-drawer";

const createEntry = vi.fn();
vi.mock("@/app/(protected)/entries/actions", () => ({ createEntry: (...a: unknown[]) => createEntry(...a) }));
vi.mock("@/app/(protected)/cards/actions", () => ({ createCard: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entries" }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

function List() {
  const { openDrawer, markRecent } = useEntryDrawer();
  return (
    <>
      <button onClick={openDrawer}>abrir</button>
      <button onClick={() => markRecent("e1")}>marcar</button>
      <table>
        <tbody>
          <EntryRow id="e1">
            <td>
              Mercado <RecentBadge id="e1" />
            </td>
          </EntryRow>
          <EntryRow id="e2">
            <td>Aluguel</td>
          </EntryRow>
        </tbody>
      </table>
      <ul>
        <EntryItem id="e1">
          <span>card e1</span>
        </EntryItem>
      </ul>
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe("destaque do lancamento recem-criado (design 3.9.2, D25)", () => {
  it("realca a linha e o card por ~2s com selo textual 'Novo' e depois remove", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<EntryDrawerProvider><List /></EntryDrawerProvider>);
    expect(screen.queryByTestId("recent-badge")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "marcar" }));
    const row = screen.getByRole("row", { name: /Mercado/ });
    expect(row).toHaveAttribute("data-recent", "true");
    expect(row.className).toContain("row-highlight");
    expect(screen.getByText("card e1").parentElement).toHaveAttribute("data-recent", "true");
    expect(screen.getByRole("row", { name: /Aluguel/ })).not.toHaveAttribute("data-recent");
    expect(screen.getByTestId("recent-badge")).toHaveTextContent("Novo");
    expect(screen.getByTestId("recent-badge")).toHaveTextContent("lançamento recém-criado");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECENT_HIGHLIGHT_MS + 50);
    });
    expect(row).not.toHaveAttribute("data-recent");
    expect(row.className).not.toContain("row-highlight");
    expect(screen.queryByTestId("recent-badge")).not.toBeInTheDocument();
  });

  it("um segundo lancamento reinicia o temporizador", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<EntryDrawerProvider><List /></EntryDrawerProvider>);
    await userEvent.click(screen.getByRole("button", { name: "marcar" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await userEvent.click(screen.getByRole("button", { name: "marcar" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true");
  });

  it("realce e ESTATICO: sem animacao/transicao no CSS (vale com prefers-reduced-motion) e so por tokens", () => {
    const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");
    const block = /\.row-highlight\s*\{([^}]*)\}/.exec(css)![1];
    expect(block).not.toMatch(/animation|transition/);
    expect(block).toContain("var(--accent)");
    expect(block).toContain("var(--card-bg-2)");
    expect(block).toMatch(/box-shadow:\s*inset 0 0 0 2px/);
  });

  it("ao salvar no drawer, a linha com o id da RESPOSTA e destacada", async () => {
    const entry = {
      id: "e1", type: "EXPENSE", description: "Mercado", category: "Alimentação", date: "2026-10-24", amount: "250.00", paymentMethod: "PIX", card: null, invoice: null,
      referenceMonth: "2026-10", status: "PAID", paidAt: "2026-10-24T13:00:00.000Z", createdAt: "", updatedAt: "",
    } satisfies EntryDto;
    createEntry.mockResolvedValue({ ok: true, data: entry });
    const state = parseEntriesSearchParams({ month: "2026-10", d_status: "ALL" }, new Date("2026-10-24T13:00:00.000Z"));
    render(
      <AllProviders>
        <EntryDrawerProvider>
          <List />
          <NewEntryDrawer today="2026-10-24" state={state} cards={[]} cardsError={false} categories={["Alimentação"]} />
        </EntryDrawerProvider>
      </AllProviders>,
    );
    await userEvent.click(screen.getByRole("button", { name: "abrir" }));
    const drawer = within(screen.getByRole("dialog", { name: "Novo lançamento" }));
    await userEvent.type(drawer.getByLabelText(/^Descrição/), "Mercado");
    await userEvent.type(drawer.getByLabelText(/^Categoria/), "Alimentação");
    await userEvent.type(drawer.getByLabelText(/^Valor/), "25000");
    await userEvent.click(drawer.getByRole("button", { name: "Salvar lançamento" }));
    await waitFor(() => expect(screen.getByRole("row", { name: /Mercado/ })).toHaveAttribute("data-recent", "true"));
  });
});

/** F2 (design 3.9.2): os ~2s contam a partir da PRIMEIRA renderizacao da linha, nao do sucesso do envio. */
function LateRow() {
  const { markRecent } = useEntryDrawer();
  const [shown, setShown] = useState(false);
  return (
    <>
      <button onClick={() => markRecent("late")}>marcar</button>
      <button onClick={() => setShown(true)}>revalidou</button>
      {shown ? (
        <table>
          <tbody>
            <EntryRow id="late">
              <td>
                Tardia <RecentBadge id="late" />
              </td>
            </EntryRow>
          </tbody>
        </table>
      ) : null}
    </>
  );
}

describe("destaque com revalidacao lenta (F2)", () => {
  it("a linha que chega 5s depois do sucesso ainda e destacada por ~2s a partir de quando aparece", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<EntryDrawerProvider><LateRow /></EntryDrawerProvider>);
    await userEvent.click(screen.getByRole("button", { name: "marcar" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await userEvent.click(screen.getByRole("button", { name: "revalidou" }));
    const row = screen.getByRole("row", { name: /Tardia/ });
    expect(row).toHaveAttribute("data-recent", "true");
    expect(screen.getByTestId("recent-badge")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECENT_HIGHLIGHT_MS - 300);
    });
    expect(row).toHaveAttribute("data-recent", "true"); // ainda dentro dos ~2s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(row).not.toHaveAttribute("data-recent");
    expect(screen.queryByTestId("recent-badge")).not.toBeInTheDocument();
  });
});

describe("navegar expira a marcacao (design 3.9.2)", () => {
  it("trocar de mes/aba/filtro (navegacao de estado) remove o destaque antes dos 2s", async () => {
    function Nav() {
      const { navigate } = useNav();
      return <button onClick={() => navigate("/entries?month=2026-11")}>navegar</button>;
    }
    render(
      <AllProviders>
        <EntryDrawerProvider>
          <List />
          <Nav />
        </EntryDrawerProvider>
      </AllProviders>,
    );
    await userEvent.click(screen.getByRole("button", { name: "marcar" }));
    expect(screen.getAllByRole("row", { name: /Mercado/ })[0]).toHaveAttribute("data-recent", "true");
    await userEvent.click(screen.getByRole("button", { name: "navegar" }));
    await waitFor(() => expect(screen.getAllByRole("row", { name: /Mercado/ })[0]).not.toHaveAttribute("data-recent"));
    expect(screen.queryByTestId("recent-badge")).not.toBeInTheDocument();
  });
});
