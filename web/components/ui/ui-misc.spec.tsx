import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BlockErrorBoundary } from "./block-error-boundary";
import { BottomSheet } from "./bottom-sheet";
import { Checkbox } from "./checkbox";
import { Money, CivilDate, MonthLabel } from "./money";
import { Pagination } from "./pagination";
import { SegmentedControl } from "./segmented-control";
import { EmptyState, InlineAlert, Skeleton } from "./states";
import { StatusBadge, StatusDot } from "./status";
import { ToastProvider, useToast } from "./toast";
import { AllProviders, router } from "@/test/helpers/providers";
import { MainNav } from "@/components/main-nav";

vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dashboard" }));
vi.mock("next/link", () => ({ default: ({ children, href, scroll, ...rest }: { children: ReactNode; href: string; scroll?: boolean } & Record<string, unknown>) => (void scroll, (<a href={href} {...rest}>{children}</a>)) }));

describe("BlockErrorBoundary (RF24, CA66)", () => {
  function Boom(): never {
    throw new Error("falha da API");
  }
  it("erro de um bloco mostra mensagem com role=alert e 'Tentar novamente', sem derrubar o resto", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <p>outro bloco</p>
        <BlockErrorBoundary message="Não foi possível carregar a evolução mensal.">
          <Boom />
        </BlockErrorBoundary>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar a evolução mensal.");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByText("outro bloco")).toBeInTheDocument();
  });
});

describe("SegmentedControl", () => {
  it("radiogroup com tabindex movel, setas selecionam pulando desabilitados", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Forma"
        value="PIX"
        onChange={onChange}
        options={[
          { value: "PIX", label: "PIX" },
          { value: "CARD", label: "Cartão", disabled: true },
          { value: "X", label: "Outro" },
        ]}
      />,
    );
    const pix = screen.getByRole("radio", { name: "PIX" });
    expect(pix).toHaveAttribute("tabindex", "0");
    pix.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("X");
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("PIX");
    await userEvent.click(screen.getByRole("radio", { name: "Cartão" }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
  it("desabilitado ignora cliques e setas", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="t" value="a" disabled onChange={onChange} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />);
    await userEvent.click(screen.getByRole("radio", { name: "B" }));
    screen.getByRole("radio", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Checkbox", () => {
  it("indeterminado e controlado por prop", () => {
    const { rerender } = render(<Checkbox aria-label="c" indeterminate readOnly />);
    expect((screen.getByLabelText("c") as HTMLInputElement).indeterminate).toBe(true);
    rerender(<Checkbox aria-label="c" readOnly />);
    expect((screen.getByLabelText("c") as HTMLInputElement).indeterminate).toBe(false);
  });
});

describe("Toast", () => {
  function Trigger({ kind }: { kind: "success" | "error" | "info" }) {
    const toast = useToast();
    return <button onClick={() => toast.push({ kind, message: `msg ${kind}`, action: { label: "Ver", href: "/x" } })}>go</button>;
  }
  it("erro tem role=alert e nao some sozinho; sucesso tem acao e fecha pelo botao; maximo de 3", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <Trigger kind="error" />
        <Trigger kind="success" />
      </ToastProvider>,
    );
    const [err, ok] = screen.getAllByRole("button", { name: "go" });
    await userEvent.click(err);
    expect(screen.getByRole("alert")).toHaveTextContent("msg error");
    await userEvent.click(ok);
    expect(screen.getAllByRole("link", { name: "Ver" })[1]).toHaveAttribute("href", "/x");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(screen.queryByText("msg success")).not.toBeInTheDocument();
    expect(screen.getByText("msg error")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByText("msg error")).not.toBeInTheDocument();
    for (let i = 0; i < 5; i++) await userEvent.click(ok);
    expect(screen.getAllByText("msg success")).toHaveLength(3);
    vi.useRealTimers();
  });
});

describe("Pagination (3.11)", () => {
  const hrefFor = (p: number) => `/entries?page=${p}`;
  it("oculta com 1 pagina", () => {
    const { container } = render(<AllProviders><Pagination page={1} totalPages={1} pageSize={20} totalItems={5} noun="despesas" hrefFor={hrefFor} focusId="t" /></AllProviders>);
    expect(container.querySelector("nav")).toBeNull();
  });
  it("intervalo, pagina atual com aria-current e links reais", () => {
    render(<AllProviders><Pagination page={3} totalPages={9} pageSize={20} totalItems={170} noun="despesas" hrefFor={hrefFor} focusId="t" /></AllProviders>);
    expect(screen.getByText("Mostrando 41-60 de 170 despesas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Página 3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Próxima página" })).toHaveAttribute("href", "/entries?page=4");
    expect(screen.getByRole("link", { name: "Página anterior" })).toHaveAttribute("href", "/entries?page=2");
    expect(screen.getByRole("link", { name: "Página 9" })).toBeInTheDocument();
  });
  it("ultima pagina nao tem 'Próxima'", () => {
    render(<AllProviders><Pagination page={2} totalPages={2} pageSize={20} totalItems={25} noun="receitas" hrefFor={hrefFor} focusId="t" /></AllProviders>);
    expect(screen.queryByRole("link", { name: "Próxima página" })).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando 21-25 de 25 receitas")).toBeInTheDocument();
  });
});

describe("MainNav", () => {
  it("item ativo com aria-current=page", () => {
    render(<MainNav />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Lançamentos" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Cartões" })).toHaveAttribute("href", "/cards");
  });
});

describe("estados e formatadores", () => {
  it("EmptyState, InlineAlert, Skeleton, badges", () => {
    render(
      <>
        <EmptyState title="Vazio" description="desc">
          <button>acao</button>
        </EmptyState>
        <InlineAlert>erro</InlineAlert>
        <InlineAlert tone="info" role="status">info</InlineAlert>
        <Skeleton />
        <StatusBadge status="PENDING" />
        <StatusBadge status="PAID" />
        <StatusBadge status="RECEIVED" />
        <StatusDot status="PAID">Pago</StatusDot>
        <Money value="-150.00" />
        <CivilDate value="2026-11-05" />
        <MonthLabel value="2026-11" />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Vazio" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("erro");
    for (const t of ["Pendente", "Recebida", "05/11/2026", "nov/26"]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0);
    expect(screen.getByText(/-R\$/)).toBeInTheDocument();
  });
  it("BottomSheet aplica e limpa", async () => {
    const onApply = vi.fn();
    const onClear = vi.fn();
    render(<BottomSheet title="Filtros" titleId="t" onClose={() => {}} onApply={onApply} onClear={onClear}><p>x</p></BottomSheet>);
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await userEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onApply).toHaveBeenCalled();
    expect(onClear).toHaveBeenCalled();
  });
});
