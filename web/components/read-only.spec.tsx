import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEMO_MODE, PROTECTED_MODE, AppModeProvider, useAppMode } from "./app-mode";
import { WriteOnly } from "./read-only";

function Probe() {
  const mode = useAppMode();
  return <p>{`${mode.kind}|${JSON.stringify(mode.basePath)}|${mode.readOnly}`}</p>;
}

describe("AppMode (ADR 9.6)", () => {
  it("constantes: protegido escreve, demo e so de visualizacao e usa /demo", () => {
    expect(PROTECTED_MODE).toEqual({ kind: "protected", basePath: "", readOnly: false });
    expect(DEMO_MODE).toEqual({ kind: "demo", basePath: "/demo", readOnly: true });
  });
  it("useAppMode le o contexto; sem provider o padrao e o protegido", () => {
    const { unmount } = render(<Probe />);
    expect(screen.getByText('protected|""|false')).toBeInTheDocument();
    unmount();
    render(
      <AppModeProvider mode={DEMO_MODE}>
        <Probe />
      </AppModeProvider>,
    );
    expect(screen.getByText('demo|"/demo"|true')).toBeInTheDocument();
  });
});

describe("WriteOnly (RF31, CA38)", () => {
  it("modo protegido renderiza os filhos", () => {
    render(
      <AppModeProvider mode={PROTECTED_MODE}>
        <WriteOnly>
          <button>Novo lançamento</button>
        </WriteOnly>
      </AppModeProvider>,
    );
    expect(screen.getByRole("button", { name: "Novo lançamento" })).toBeInTheDocument();
  });

  it("DEMO_MODE nao renderiza NADA: nem desabilitado, nem oculto (nao esta no DOM)", () => {
    const { container } = render(
      <AppModeProvider mode={DEMO_MODE}>
        <WriteOnly>
          <button>Novo lançamento</button>
          <input type="checkbox" aria-label="Selecionar" />
        </WriteOnly>
      </AppModeProvider>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Novo lançamento")).not.toBeInTheDocument();
  });

  it("os filhos nem sao montados em readOnly (efeitos e imports de escrita nao rodam)", () => {
    let mounted = false;
    function Child() {
      mounted = true;
      return null;
    }
    render(
      <AppModeProvider mode={DEMO_MODE}>
        <WriteOnly>
          <Child />
        </WriteOnly>
      </AppModeProvider>,
    );
    expect(mounted).toBe(false);
  });
});
