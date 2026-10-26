import { cloneElement, type ReactElement } from "react";

/** jsdom nao mede layout: ResponsiveContainer ganha tamanho fixo para os graficos renderizarem o SVG. */
export function mockedRecharts<T extends object>(original: T) {
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) => (
      <div style={{ width: 800, height: 300 }}>{cloneElement(children, { width: 800, height: 300 })}</div>
    ),
  };
}
