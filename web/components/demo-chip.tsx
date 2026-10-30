/** Chip "Demonstração" (PA4): texto `--accent` com borda; aparece ao lado da marca em `/demo/*`. */
export function DemoChip({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-semibold text-accent ${className}`.trim()}>Demonstração</span>;
}
