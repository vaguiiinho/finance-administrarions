import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./reduced-motion";

function Probe() {
  return <p>{usePrefersReducedMotion() ? "reduzido" : "normal"}</p>;
}

function mockMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = { matches, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) };
  vi.stubGlobal("matchMedia", () => media);
  return (next: boolean) => {
    media.matches = next;
    listeners.forEach((cb) => cb());
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("usePrefersReducedMotion (CA87)", () => {
  it("reflete a preferencia e muda ao vivo", () => {
    const set = mockMedia(false);
    render(<Probe />);
    expect(screen.getByText("normal")).toBeInTheDocument();
    act(() => set(true));
    expect(screen.getByText("reduzido")).toBeInTheDocument();
  });
  it("sem matchMedia assume movimento reduzido (sem animacao)", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<Probe />);
    expect(screen.getByText("reduzido")).toBeInTheDocument();
  });
});
